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
const loadingFonts = new Map<string, Promise<void>>()

export async function loadFont(fontKey: string): Promise<void> {
  if (fontKey === 'system') {
    console.log('📝 Using system font')
    return Promise.resolve()
  }
  
  if (loadedFonts.has(fontKey)) {
    console.log('✅ Font already loaded:', fontKey)
    return Promise.resolve()
  }

  // If font is currently loading, return the existing promise
  if (loadingFonts.has(fontKey)) {
    console.log('⏳ Font already loading:', fontKey)
    return loadingFonts.get(fontKey)!
  }

  const fontFamily = FONT_FAMILIES[fontKey]
  if (!fontFamily) {
    console.warn(`Unknown font: ${fontKey}`)
    return Promise.resolve()
  }

  console.log('🔤 Loading font:', fontFamily)

  // Create a promise for this font loading
  const loadPromise = new Promise<void>((resolve) => {
    // Create a link element to load the font from Bunny Fonts
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `https://fonts.bunny.net/css?family=${encodeURIComponent(fontFamily.toLowerCase().replace(/ /g, '-'))}:400,400i,700,700i`
    
    // Wait for the stylesheet to load
    link.onload = () => {
      console.log('📄 Stylesheet loaded for:', fontFamily)
      
      // Use Font Loading API to wait for the actual font to be ready
      if ('fonts' in document) {
        Promise.all([
          document.fonts.load(`400 16px "${fontFamily}"`),
          document.fonts.load(`700 16px "${fontFamily}"`)
        ]).then(() => {
          console.log('✅ Font ready:', fontFamily)
          loadedFonts.add(fontKey)
          loadingFonts.delete(fontKey)
          resolve()
        }).catch((err) => {
          console.warn('⚠️ Font loading failed:', fontFamily, err)
          loadedFonts.add(fontKey) // Mark as loaded anyway to prevent retries
          loadingFonts.delete(fontKey)
          resolve()
        })
      } else {
        // Fallback: just wait a bit for older browsers
        setTimeout(() => {
          console.log('✅ Font assumed ready (no Font Loading API):', fontFamily)
          loadedFonts.add(fontKey)
          loadingFonts.delete(fontKey)
          resolve()
        }, 100)
      }
    }
    
    link.onerror = () => {
      console.error('❌ Failed to load font stylesheet:', fontFamily)
      loadedFonts.add(fontKey) // Mark as loaded to prevent retries
      loadingFonts.delete(fontKey)
      resolve() // Resolve anyway so we don't block
    }
    
    document.head.appendChild(link)
  })

  loadingFonts.set(fontKey, loadPromise)
  return loadPromise
}

export function getFontFamily(fontKey: string | undefined): string {
  if (!fontKey || fontKey === 'system') {
    return 'system-ui, -apple-system, sans-serif'
  }

  const fontFamily = FONT_FAMILIES[fontKey]
  return fontFamily ? `'${fontFamily}', serif` : 'system-ui, -apple-system, sans-serif'
}
