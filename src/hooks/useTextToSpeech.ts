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
        // pick best match by language first, then default
        const byLang = v.find(x => x.lang?.toLowerCase().startsWith(defaultLang.toLowerCase()))
        setVoice(byLang || v[0] || null)
      }
    }
    load()
    // Safari/Chrome fire 'voiceschanged'
    const handleVoicesChanged = () => load()
    synth!.addEventListener('voiceschanged', handleVoicesChanged)
    return () => {
      synth!.removeEventListener('voiceschanged', handleVoicesChanged)
    }
  }, [supported, defaultLang, voice, synth])

  const createUtterance = (text: string): SpeechSynthesisUtterance => {
    const SpeechSynthesisUtteranceConstructor = (window as Window & typeof globalThis).SpeechSynthesisUtterance
    const u = new SpeechSynthesisUtteranceConstructor(text) as SpeechSynthesisUtterance
    u.lang = voice?.lang || defaultLang
    if (voice) u.voice = voice
    u.rate = rate
    u.pitch = pitch
    u.volume = volume

    u.onstart = () => { setSpeaking(true); setPaused(false) }
    u.onpause = () => setPaused(true)
    u.onresume = () => setPaused(false)
    u.onend = () => { setSpeaking(false); setPaused(false); utteranceRef.current = null }
    u.onerror = () => { setSpeaking(false); setPaused(false); utteranceRef.current = null }
    u.onboundary = (ev: SpeechSynthesisEvent) => {
      if (typeof ev.charIndex === 'number') {
        // Keep track of where we are in the original text
        const newIndex = ev.charIndex
        if (newIndex > charIndexRef.current) {
          charIndexRef.current = newIndex
        }
      }
    }

    return u
  }

  const stop = useCallback(() => {
    if (!supported) return
    synth!.cancel()
    setSpeaking(false)
    setPaused(false)
    utteranceRef.current = null
    charIndexRef.current = 0
    spokenTextRef.current = ''
  }, [supported, synth])

  const speak = useCallback((text: string, langOverride?: string) => {
    if (!supported || !text?.trim()) return
    // stopping any current speech first is safer for iOS
    synth!.cancel()
    spokenTextRef.current = text
    charIndexRef.current = 0

    const u = createUtterance(text)
    if (langOverride) u.lang = langOverride

    utteranceRef.current = u
    synth!.speak(u)
  }, [supported, synth, voice, rate, pitch, volume, defaultLang])

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

    // If currently speaking (not paused), restart from last boundary to apply new rate immediately.
    if (synth!.speaking && !synth!.paused) {
      const fullText = spokenTextRef.current
      const startIndex = Math.max(0, Math.min(charIndexRef.current, fullText.length - 1))
      const remainingText = fullText.slice(startIndex)

      // Cancel current utterance and start a new one with updated rate
      synth!.cancel()
      const u = createUtterance(remainingText)
      utteranceRef.current = u
      synth!.speak(u)
      return
    }

    // If paused or not speaking, set rate; it will take effect on resume/start
    if (utteranceRef.current) {
      utteranceRef.current.rate = rate
    }
  }, [rate, supported, synth])

  // stop TTS when unmounting
  useEffect(() => stop, [stop])

  return useMemo(() => ({
    supported,
    speaking,
    paused,
    voices,
    voice,
    rate, setRate,
    pitch, setPitch,
    volume, setVolume,
    setVoice,
    speak, pause, resume, stop
  }), [supported, speaking, paused, voices, voice, rate, pitch, volume, setVoice, speak, pause, resume, stop])
}

