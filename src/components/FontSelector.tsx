import React from 'react'

interface FontSelectorProps {
  value: string
  onChange: (font: string) => void
}

const FONTS = [
  { value: 'system', label: 'System Default', family: 'system-ui, -apple-system, sans-serif' },
  { value: 'inter', label: 'Inter', family: 'Inter, sans-serif' },
  { value: 'lora', label: 'Lora', family: 'Lora, serif' },
  { value: 'merriweather', label: 'Merriweather', family: 'Merriweather, serif' },
  { value: 'open-sans', label: 'Open Sans', family: 'Open Sans, sans-serif' },
  { value: 'roboto', label: 'Roboto', family: 'Roboto, sans-serif' },
  { value: 'source-serif-4', label: 'Source Serif 4', family: 'Source Serif 4, serif' },
  { value: 'crimson-text', label: 'Crimson Text', family: 'Crimson Text, serif' },
  { value: 'libre-baskerville', label: 'Libre Baskerville', family: 'Libre Baskerville, serif' },
  { value: 'pt-serif', label: 'PT Serif', family: 'PT Serif, serif' }
]

const FontSelector: React.FC<FontSelectorProps> = ({ value, onChange }) => {
  return (
    <select
      id="readingFont"
      value={value || 'system'}
      onChange={(e) => onChange(e.target.value)}
      className="setting-select font-select"
    >
      {FONTS.map(font => (
        <option key={font.value} value={font.value} style={{ fontFamily: font.family }}>
          {font.label}
        </option>
      ))}
    </select>
  )
}

export default FontSelector
