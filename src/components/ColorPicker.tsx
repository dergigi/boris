import React from 'react'
import { HIGHLIGHT_COLORS } from '../utils/colorHelpers'

interface ColorPickerProps {
  selectedColor: string
  onColorChange: (color: string) => void
  colors?: typeof HIGHLIGHT_COLORS
}

const ColorPicker: React.FC<ColorPickerProps> = ({ selectedColor, onColorChange, colors = HIGHLIGHT_COLORS }) => {
  return (
    <div className="color-picker">
      {colors.map(color => (
        <button
          key={color.value}
          onClick={() => onColorChange(color.value)}
          className={`color-swatch ${selectedColor === color.value ? 'active' : ''}`}
          style={{ backgroundColor: color.value }}
          title={color.name}
          aria-label={`${color.name} color`}
        />
      ))}
    </div>
  )
}

export default ColorPicker
