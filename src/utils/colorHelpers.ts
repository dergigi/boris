// Helper to convert hex color to RGB values
export function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result 
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '255, 255, 0'
}

// Tailwind color palette for highlight colors
export const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#fde047' },  // yellow-300
  { name: 'Orange', value: '#f97316' },  // orange-500
  { name: 'Pink', value: '#ec4899' },    // pink-500
  { name: 'Green', value: '#22c55e' },   // green-500
  { name: 'Blue', value: '#3b82f6' },    // blue-500
  { name: 'Purple', value: '#9333ea' }   // purple-600
]

// Tailwind color palette for link colors - optimized for dark themes
export const LINK_COLORS_DARK = [
  { name: 'Sky Blue', value: '#38bdf8' },  // sky-400
  { name: 'Cyan', value: '#22d3ee' },      // cyan-400
  { name: 'Light Blue', value: '#60a5fa' }, // blue-400
  { name: 'Indigo Light', value: '#818cf8' }, // indigo-400
  { name: 'Blue', value: '#3b82f6' },      // blue-500
  { name: 'Purple', value: '#9333ea' }     // purple-600
]

// Tailwind color palette for link colors - optimized for light themes
export const LINK_COLORS_LIGHT = [
  { name: 'Blue', value: '#3b82f6' },      // blue-500
  { name: 'Indigo', value: '#6366f1' },     // indigo-500
  { name: 'Purple', value: '#9333ea' },    // purple-600
  { name: 'Sky Blue', value: '#0ea5e9' },   // sky-500 (darker for light bg)
  { name: 'Cyan', value: '#06b6d4' },      // cyan-500 (darker for light bg)
  { name: 'Teal', value: '#14b8a6' }       // teal-500
]
