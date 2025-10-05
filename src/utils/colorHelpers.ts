// Helper to convert hex color to RGB values
export function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result 
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '255, 255, 0'
}

export const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#ffff00' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Pink', value: '#ff69b4' },
  { name: 'Green', value: '#00ff7f' },
  { name: 'Blue', value: '#4da6ff' },
  { name: 'Purple', value: '#9333ea' }
]
