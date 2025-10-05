import React from 'react'
import { HIGHLIGHT_COLORS } from '../utils/colorHelpers'

interface ColorPickerProps {
  selectedColor: string
  onColorChange: (color: string) => void
}

const ColorPicker: React.FC<ColorPickerProps> = ({ selectedColor, onColorChange }) => {
  return (
    <div className="color-picker">
      {HIGHLIGHT_COLORS.map(color => (
        <button
          key={color.value}
          onClick={() => onColorChange(color.value)}
          className={`color-swatch ${selectedColor === color.value ? 'active' : ''}`}
          style={{ backgroundColor: color.value }}
          title={color.name}
          aria-label={`${color.name} highlight color`}
        />
      ))}
    </div>
  )
}

export default ColorPicker
