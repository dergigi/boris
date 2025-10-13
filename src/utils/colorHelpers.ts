// Helper to convert hex color to RGB values
export function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result 
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '255, 255, 0'
}

// Tailwind color palette for highlight colors
export const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#facc15' },  // yellow-400
  { name: 'Orange', value: '#f97316' },  // orange-500
  { name: 'Pink', value: '#ec4899' },    // pink-500
  { name: 'Green', value: '#22c55e' },   // green-500
  { name: 'Blue', value: '#3b82f6' },    // blue-500
  { name: 'Purple', value: '#9333ea' }   // purple-600
]
