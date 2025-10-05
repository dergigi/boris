// Map of font names to their Bunny Fonts family names
const FONT_FAMILIES: Record<string, string> = {
  'inter': 'Inter',
  'lora': 'Lora',
  'merriweather': 'Merriweather',
  'open-sans': 'Open Sans',
  'roboto': 'Roboto',
  'source-serif-4': 'Source Serif 4',
  'crimson-text': 'Crimson Text',
  'libre-baskerville': 'Libre Baskerville',
  'pt-serif': 'PT Serif'
}

const loadedFonts = new Set<string>()

export function loadFont(fontKey: string) {
  if (fontKey === 'system' || loadedFonts.has(fontKey)) {
    return
  }

  const fontFamily = FONT_FAMILIES[fontKey]
  if (!fontFamily) {
    console.warn(`Unknown font: ${fontKey}`)
    return
  }

  // Create a link element to load the font from Bunny Fonts
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.bunny.net/css?family=${encodeURIComponent(fontFamily.toLowerCase().replace(/ /g, '-'))}:400,400i,700,700i`
  document.head.appendChild(link)

  loadedFonts.add(fontKey)
}

export function getFontFamily(fontKey: string | undefined): string {
  if (!fontKey || fontKey === 'system') {
    return 'system-ui, -apple-system, sans-serif'
  }

  const fontFamily = FONT_FAMILIES[fontKey]
  return fontFamily ? `'${fontFamily}', serif` : 'system-ui, -apple-system, sans-serif'
}
