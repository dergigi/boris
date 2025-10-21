import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Web Speech API types
type SpeechSynthesisVoice = {
  name: string
  voiceURI: string
  lang: string
  localService: boolean
  default: boolean
}

export interface UseTTSOptions {
  defaultLang?: string
  defaultRate?: number
  defaultPitch?: number
  defaultVolume?: number
}

export interface UseTTS {
  supported: boolean
  speaking: boolean
  paused: boolean
  voices: SpeechSynthesisVoice[]
  voice: SpeechSynthesisVoice | null
  rate: number
  pitch: number
  volume: number
  setVoice: (v: SpeechSynthesisVoice | null) => void
  setRate: (r: number) => void
  setPitch: (p: number) => void
  setVolume: (v: number) => void
  speak: (text: string, langOverride?: string) => void
  pause: () => void
  resume: () => void
  stop: () => void
}

export function useTextToSpeech(options: UseTTSOptions = {}): UseTTS {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
  const supported = !!synth
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const [paused, setPaused] = useState(false)
  const [rate, setRate] = useState(options.defaultRate ?? 2.1)
  const [pitch, setPitch] = useState(options.defaultPitch ?? 1)
  const [volume, setVolume] = useState(options.defaultVolume ?? 1)
  const defaultLang = options.defaultLang || (typeof navigator !== 'undefined' ? navigator.language : 'en')

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const spokenTextRef = useRef<string>('')
  const charIndexRef = useRef<number>(0)
  // Chunking state to reliably speak long texts from web URLs
  const chunksRef = useRef<string[]>([])
  const chunkIndexRef = useRef<number>(0)
  const globalOffsetRef = useRef<number>(0)
  const langRef = useRef<string | undefined>(undefined)

  // Update rate when defaultRate option changes
  useEffect(() => {
    if (options.defaultRate !== undefined) {
      setRate(options.defaultRate)
    }
  }, [options.defaultRate])

  // Load voices (async in many browsers)
  useEffect(() => {
    if (!supported) return
    const load = () => {
      const v = synth!.getVoices()
      setVoices(v)
      if (!voice && v.length) {
        const byLang = v.find(x => x.lang?.toLowerCase().startsWith(defaultLang.toLowerCase()))
        setVoice(byLang || v[0] || null)
      }
    }
    load()
    const handleVoicesChanged = () => load()
    synth!.addEventListener('voiceschanged', handleVoicesChanged)
    return () => {
      synth!.removeEventListener('voiceschanged', handleVoicesChanged)
    }
  }, [supported, defaultLang, voice, synth])

  const createUtterance = useCallback((text: string, langOverride?: string): SpeechSynthesisUtterance => {
    const SpeechSynthesisUtteranceConstructor = (window as Window & typeof globalThis).SpeechSynthesisUtterance
    const u = new SpeechSynthesisUtteranceConstructor(text) as SpeechSynthesisUtterance
    const resolvedLang = langOverride || voice?.lang || defaultLang
    u.lang = resolvedLang
    if (langOverride) {
      const match = voices.find(v => v.lang?.toLowerCase().startsWith(langOverride.toLowerCase()))
      if (match) {
        u.voice = match
      } else if (voice) {
        u.voice = voice
      }
    } else if (voice) {
      u.voice = voice
    }
    u.rate = rate
    u.pitch = pitch
    u.volume = volume

    const self = u

    u.onstart = () => {
      if (utteranceRef.current !== self) return
      setSpeaking(true)
      setPaused(false)
    }
    u.onpause = () => {
      if (utteranceRef.current !== self) return
      setPaused(true)
    }
    u.onresume = () => {
      if (utteranceRef.current !== self) return
      setPaused(false)
    }
    u.onend = () => {
      if (utteranceRef.current !== self) return
      // Continue with next chunk if available
      const hasMore = chunkIndexRef.current < (chunksRef.current.length - 1)
      if (hasMore) {
        chunkIndexRef.current++
        charIndexRef.current += self.text.length
        const nextChunk = chunksRef.current[chunkIndexRef.current]
        const nextUtterance = createUtterance(nextChunk, langRef.current)
        utteranceRef.current = nextUtterance
        synth!.speak(nextUtterance)
      } else {
        setSpeaking(false)
        setPaused(false)
      }
    }
    u.onerror = () => {
      if (utteranceRef.current !== self) return
      setSpeaking(false)
      setPaused(false)
    }
    u.onboundary = (ev: SpeechSynthesisEvent) => {
      if (utteranceRef.current !== self) return
      if (typeof ev.charIndex === 'number') {
        const newIndex = globalOffsetRef.current + ev.charIndex
        if (newIndex > charIndexRef.current) {
          charIndexRef.current = newIndex
        }
      }
    }

    return u
  }, [voice, defaultLang, rate, pitch, volume, voices, synth])

  const splitIntoChunks = useCallback((text: string, maxLen = 2400): string[] => {
    const normalized = text.replace(/\s+/g, ' ').trim()
    if (normalized.length <= maxLen) return [normalized]
    const sentences = normalized.split(/(?<=[.!?])\s+/)
    const chunks: string[] = []
    let current = ''
    for (const s of sentences) {
      if ((current + (current ? ' ' : '') + s).length > maxLen) {
        if (current) chunks.push(current)
        if (s.length > maxLen) {
          // Hard split very long sentence
          for (let i = 0; i < s.length; i += maxLen) {
            chunks.push(s.slice(i, i + maxLen))
          }
          current = ''
        } else {
          current = s
        }
      } else {
        current = current ? `${current} ${s}` : s
      }
    }
    if (current) chunks.push(current)
    return chunks
  }, [])

  const startSpeakingChunks = useCallback((text: string) => {
    chunksRef.current = splitIntoChunks(text)
    chunkIndexRef.current = 0
    globalOffsetRef.current = 0
    const first = chunksRef.current[0] || ''
    const u = createUtterance(first, langRef.current)
    utteranceRef.current = u
    synth!.speak(u)
  }, [createUtterance, splitIntoChunks, synth])

  const stop = useCallback(() => {
    if (!supported) return
    synth!.cancel()
    setSpeaking(false)
    setPaused(false)
    utteranceRef.current = null
    charIndexRef.current = 0
    spokenTextRef.current = ''
    chunksRef.current = []
    chunkIndexRef.current = 0
    globalOffsetRef.current = 0
  }, [supported, synth])

  const speak = useCallback((text: string, langOverride?: string) => {
    if (!supported || !text?.trim()) return
    synth!.cancel()
    spokenTextRef.current = text
    charIndexRef.current = 0
    langRef.current = langOverride
    startSpeakingChunks(text)
  }, [supported, synth, startSpeakingChunks])

  const pause = useCallback(() => {
    if (!supported) return
    if (synth!.speaking && !synth!.paused) {
      synth!.pause()
      setPaused(true)
    }
  }, [supported, synth])

  const resume = useCallback(() => {
    if (!supported) return
    if (synth!.speaking && synth!.paused) {
      synth!.resume()
      setPaused(false)
    }
  }, [supported, synth])

  // Update rate in real-time: while speaking, restart from last boundary with new rate.
  useEffect(() => {
    if (!supported) return
    if (!utteranceRef.current) return

    if (synth!.speaking && !synth!.paused) {
      const fullText = spokenTextRef.current
      const startIndex = Math.max(0, Math.min(charIndexRef.current, fullText.length))
      const remainingText = fullText.slice(startIndex)

      synth!.cancel()
      // restart chunked from current global index
      spokenTextRef.current = remainingText
      charIndexRef.current = 0
      // keep current language selection; no change needed here
      startSpeakingChunks(remainingText)
      return
    }

    if (utteranceRef.current) {
      utteranceRef.current.rate = rate
    }
  }, [rate, supported, synth, startSpeakingChunks])

  const updateRate = useCallback((newRate: number) => {
    setRate(newRate)
    if (!supported) return
    if (!utteranceRef.current) return

    if (synth!.speaking && !synth!.paused) {
      const fullText = spokenTextRef.current
      const startIndex = Math.max(0, Math.min(charIndexRef.current, fullText.length - 1))
      const remainingText = fullText.slice(startIndex)
      synth!.cancel()
      const u = createUtterance(remainingText)
      // ensure the new rate is applied immediately on the new utterance
      u.rate = newRate
      utteranceRef.current = u
      synth!.speak(u)
    } else if (utteranceRef.current) {
      utteranceRef.current.rate = newRate
    }
  }, [supported, synth, createUtterance])

  // stop TTS when unmounting
  useEffect(() => stop, [stop])

  return useMemo(() => ({
    supported,
    speaking,
    paused,
    voices,
    voice,
    rate,
    setRate: updateRate,
    pitch, setPitch,
    volume, setVolume,
    setVoice,
    speak, pause, resume, stop
  }), [supported, speaking, paused, voices, voice, rate, updateRate, pitch, volume, setVoice, speak, pause, resume, stop])
}

