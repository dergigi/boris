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
      console.debug('[tts] defaultRate changed ->', options.defaultRate)
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
        console.debug('[tts] voices loaded', { total: v.length, picked: (byLang || v[0] || null)?.lang })
      }
    }
    load()
    const handleVoicesChanged = () => load()
    synth!.addEventListener('voiceschanged', handleVoicesChanged)
    return () => {
      synth!.removeEventListener('voiceschanged', handleVoicesChanged)
    }
  }, [supported, defaultLang, voice, synth])

  const createUtterance = useCallback((text: string): SpeechSynthesisUtterance => {
    const SpeechSynthesisUtteranceConstructor = (window as Window & typeof globalThis).SpeechSynthesisUtterance
    const u = new SpeechSynthesisUtteranceConstructor(text) as SpeechSynthesisUtterance
    u.lang = voice?.lang || defaultLang
    if (voice) u.voice = voice
    u.rate = rate
    u.pitch = pitch
    u.volume = volume

    const self = u

    u.onstart = () => {
      if (utteranceRef.current !== self) return
      console.debug('[tts] onstart')
      setSpeaking(true)
      setPaused(false)
    }
    u.onpause = () => {
      if (utteranceRef.current !== self) return
      console.debug('[tts] onpause')
      setPaused(true)
    }
    u.onresume = () => {
      if (utteranceRef.current !== self) return
      console.debug('[tts] onresume')
      setPaused(false)
    }
    u.onend = () => {
      if (utteranceRef.current !== self) return
      console.debug('[tts] onend')
      setSpeaking(false)
      setPaused(false)
      utteranceRef.current = null
    }
    u.onerror = () => {
      if (utteranceRef.current !== self) return
      console.debug('[tts] onerror')
      setSpeaking(false)
      setPaused(false)
      utteranceRef.current = null
    }
    u.onboundary = (ev: SpeechSynthesisEvent) => {
      if (utteranceRef.current !== self) return
      if (typeof ev.charIndex === 'number') {
        const newIndex = ev.charIndex
        if (newIndex > charIndexRef.current) {
          charIndexRef.current = newIndex
        }
      }
    }

    return u
  }, [voice, defaultLang, rate, pitch, volume])

  const stop = useCallback(() => {
    if (!supported) return
    console.debug('[tts] stop')
    synth!.cancel()
    setSpeaking(false)
    setPaused(false)
    utteranceRef.current = null
    charIndexRef.current = 0
    spokenTextRef.current = ''
  }, [supported, synth])

  const speak = useCallback((text: string, langOverride?: string) => {
    if (!supported || !text?.trim()) return
    console.debug('[tts] speak', { len: text.length, rate })
    synth!.cancel()
    spokenTextRef.current = text
    charIndexRef.current = 0

    const u = createUtterance(text)
    if (langOverride) u.lang = langOverride

    utteranceRef.current = u
    synth!.speak(u)
  }, [supported, synth, createUtterance, rate])

  const pause = useCallback(() => {
    if (!supported) return
    if (synth!.speaking && !synth!.paused) {
      console.debug('[tts] pause')
      synth!.pause()
      setPaused(true)
    }
  }, [supported, synth])

  const resume = useCallback(() => {
    if (!supported) return
    if (synth!.speaking && synth!.paused) {
      console.debug('[tts] resume')
      synth!.resume()
      setPaused(false)
    }
  }, [supported, synth])

  // Update rate in real-time: while speaking, restart from last boundary with new rate.
  useEffect(() => {
    if (!supported) return
    if (!utteranceRef.current) return

    console.debug('[tts] rate change', { rate, speaking: synth!.speaking, paused: synth!.paused, charIndex: charIndexRef.current })

    if (synth!.speaking && !synth!.paused) {
      const fullText = spokenTextRef.current
      const startIndex = Math.max(0, Math.min(charIndexRef.current, fullText.length - 1))
      const remainingText = fullText.slice(startIndex)

      console.debug('[tts] restart at new rate', { startIndex, remainingLen: remainingText.length })
      synth!.cancel()
      const u = createUtterance(remainingText)
      utteranceRef.current = u
      synth!.speak(u)
      return
    }

    if (utteranceRef.current) {
      utteranceRef.current.rate = rate
    }
  }, [rate, supported, synth, createUtterance])

  const updateRate = useCallback((newRate: number) => {
    setRate(newRate)
    if (!supported) return
    if (!utteranceRef.current) return

    if (synth!.speaking && !synth!.paused) {
      const fullText = spokenTextRef.current
      const startIndex = Math.max(0, Math.min(charIndexRef.current, fullText.length - 1))
      const remainingText = fullText.slice(startIndex)
      console.debug('[tts] updateRate -> restart', { newRate, startIndex, remainingLen: remainingText.length })
      synth!.cancel()
      const u = createUtterance(remainingText)
      // ensure the new rate is applied immediately on the new utterance
      u.rate = newRate
      utteranceRef.current = u
      synth!.speak(u)
    } else if (utteranceRef.current) {
      console.debug('[tts] updateRate -> set on utterance', { newRate })
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

