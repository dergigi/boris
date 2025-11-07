import React from 'react'
import { faHighlighter, faUnderline, faNetworkWired, faUserGroup, faUser, faAlignLeft, faAlignJustify } from '@fortawesome/free-solid-svg-icons'
import { UserSettings } from '../../services/settingsService'
import IconButton from '../IconButton'
import ColorPicker from '../ColorPicker'
import FontSelector from '../FontSelector'
import { getFontFamily } from '../../utils/fontLoader'
import { hexToRgb, LINK_COLORS_DARK, LINK_COLORS_LIGHT } from '../../utils/colorHelpers'

interface ReadingDisplaySettingsProps {
  settings: UserSettings
  onUpdate: (updates: Partial<UserSettings>) => void
}

const ReadingDisplaySettings: React.FC<ReadingDisplaySettingsProps> = ({ settings, onUpdate }) => {
  const previewFontFamily = getFontFamily(settings.readingFont || 'source-serif-4')
  
  // Determine current effective theme for color palette selection
  const currentTheme = settings.theme ?? 'system'
  const isDark = currentTheme === 'dark' || 
    (currentTheme === 'system' && (typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : true))
  const linkColors = isDark ? LINK_COLORS_DARK : LINK_COLORS_LIGHT
  const currentLinkColor = isDark 
    ? (settings.linkColorDark || '#38bdf8')
    : (settings.linkColorLight || '#3b82f6')
  
  const handleLinkColorChange = (color: string) => {
    if (isDark) {
      onUpdate({ linkColorDark: color })
    } else {
      onUpdate({ linkColorLight: color })
    }
  }

  return (
    <div className="settings-section">
      <h3 className="section-title">Reading & Display</h3>
      
      <div className="setting-group setting-inline">
        <label>Highlight Style</label>
        <div className="setting-buttons">
          <IconButton 
            icon={faHighlighter} 
            onClick={() => onUpdate({ highlightStyle: 'marker' })} 
            title="Text marker style" 
            ariaLabel="Text marker style" 
            variant={(settings.highlightStyle || 'marker') === 'marker' ? 'primary' : 'ghost'} 
          />
          <IconButton 
            icon={faUnderline} 
            onClick={() => onUpdate({ highlightStyle: 'underline' })} 
            title="Underline style" 
            ariaLabel="Underline style" 
            variant={settings.highlightStyle === 'underline' ? 'primary' : 'ghost'} 
          />
        </div>
      </div>

      <div className="setting-group setting-inline">
        <label>Paragraph Alignment</label>
        <div className="setting-buttons">
          <IconButton 
            icon={faAlignLeft} 
            onClick={() => onUpdate({ paragraphAlignment: 'left' })} 
            title="Left aligned" 
            ariaLabel="Left aligned" 
            variant={settings.paragraphAlignment === 'left' ? 'primary' : 'ghost'} 
          />
          <IconButton 
            icon={faAlignJustify} 
            onClick={() => onUpdate({ paragraphAlignment: 'justify' })} 
            title="Justified" 
            ariaLabel="Justified" 
            variant={(settings.paragraphAlignment || 'justify') === 'justify' ? 'primary' : 'ghost'} 
          />
        </div>
      </div>


      <div className="setting-group setting-inline">
        <label>Default Highlight Visibility</label>
        <div className="highlight-level-toggles">
          <IconButton
            icon={faNetworkWired}
            onClick={() => onUpdate({ defaultHighlightVisibilityNostrverse: !(settings.defaultHighlightVisibilityNostrverse !== false) })}
            title="Nostrverse highlights"
            ariaLabel="Toggle nostrverse highlights by default"
            variant="ghost"
            style={{ 
              color: (settings.defaultHighlightVisibilityNostrverse !== false) ? 'var(--highlight-color-nostrverse, #9333ea)' : undefined,
              opacity: (settings.defaultHighlightVisibilityNostrverse !== false) ? 1 : 0.4
            }}
          />
          <IconButton
            icon={faUserGroup}
            onClick={() => onUpdate({ defaultHighlightVisibilityFriends: !(settings.defaultHighlightVisibilityFriends !== false) })}
            title="Friends highlights"
            ariaLabel="Toggle friends highlights by default"
            variant="ghost"
            style={{ 
              color: (settings.defaultHighlightVisibilityFriends !== false) ? 'var(--highlight-color-friends, #f97316)' : undefined,
              opacity: (settings.defaultHighlightVisibilityFriends !== false) ? 1 : 0.4
            }}
          />
          <IconButton
            icon={faUser}
            onClick={() => onUpdate({ defaultHighlightVisibilityMine: !(settings.defaultHighlightVisibilityMine !== false) })}
            title="My highlights"
            ariaLabel="Toggle my highlights by default"
            variant="ghost"
            style={{ 
              color: (settings.defaultHighlightVisibilityMine !== false) ? 'var(--highlight-color-mine, #eab308)' : undefined,
              opacity: (settings.defaultHighlightVisibilityMine !== false) ? 1 : 0.4
            }}
          />
        </div>
      </div>

      <div className="setting-group setting-inline">
        <label htmlFor="readingFont">Reading Font</label>
        <div className="setting-control">
          <FontSelector
            value={settings.readingFont || 'source-serif-4'}
            onChange={(font) => onUpdate({ readingFont: font })}
          />
        </div>
      </div>

      <div className="setting-group setting-inline">
        <label className="setting-label">Link Color</label>
        <div className="setting-control">
          <ColorPicker
            selectedColor={currentLinkColor}
            onColorChange={handleLinkColorChange}
            colors={linkColors}
          />
        </div>
      </div>

      <div className="setting-group setting-inline">
        <label className="setting-label">Font Size</label>
        <div className="setting-control">
          <div className="setting-buttons">
            {[16, 18, 21, 24, 28, 32].map(size => (
              <button
                key={size}
                onClick={() => onUpdate({ fontSize: size })}
                className={`font-size-btn ${(settings.fontSize || 21) === size ? 'active' : ''}`}
                title={`${size}px`}
                style={{ fontSize: `${size - 2}px` }}
              >
                A
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="setting-group setting-inline">
        <label className="setting-label">My Highlights</label>
        <div className="setting-control">
          <ColorPicker
            selectedColor={settings.highlightColorMine || '#fde047'}
            onColorChange={(color) => onUpdate({ highlightColorMine: color })}
          />
        </div>
      </div>

      <div className="setting-group setting-inline">
        <label className="setting-label">Friends Highlights</label>
        <div className="setting-control">
          <ColorPicker
            selectedColor={settings.highlightColorFriends || '#f97316'}
            onColorChange={(color) => onUpdate({ highlightColorFriends: color })}
          />
        </div>
      </div>

      <div className="setting-group setting-inline">
        <label className="setting-label">Nostrverse Highlights</label>
        <div className="setting-control">
          <ColorPicker
            selectedColor={settings.highlightColorNostrverse || '#9333ea'}
            onColorChange={(color) => onUpdate({ highlightColorNostrverse: color })}
          />
        </div>
      </div>

      <div className="setting-group">
        <label htmlFor="showHighlights" className="checkbox-label">
          <input
            id="showHighlights"
            type="checkbox"
            checked={settings.showHighlights !== false}
            onChange={(e) => onUpdate({ showHighlights: e.target.checked })}
            className="setting-checkbox"
          />
          <span>Show highlights</span>
        </label>
      </div>

      <div className="setting-preview">
        <div className="preview-label">Preview</div>
        <div 
          className="preview-content" 
          style={{ 
            fontFamily: previewFontFamily,
            fontSize: `${settings.fontSize || 21}px`,
            '--highlight-rgb': hexToRgb(settings.highlightColor || '#ffff00'),
            '--paragraph-alignment': settings.paragraphAlignment || 'justify',
            '--color-link': isDark 
              ? (settings.linkColorDark || '#38bdf8')
              : (settings.linkColorLight || '#3b82f6')
          } as React.CSSProperties}
        >
          <h3>The Quick Brown Fox</h3>
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. <span className={settings.showHighlights !== false && settings.defaultHighlightVisibilityMine !== false ? `content-highlight-${settings.highlightStyle || 'marker'} level-mine` : ""}>Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</span> Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
          <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. <span className={settings.showHighlights !== false && settings.defaultHighlightVisibilityFriends !== false ? `content-highlight-${settings.highlightStyle || 'marker'} level-friends` : ""}>Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</span> Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.</p>
          <p>Totam rem aperiam, eaque ipsa quae ab illo <a href="/a/naddr1qvzqqqr4gupzqmjxss3dld622uu8q25gywum9qtg4w4cv4064jmg20xsac2aam5nqq8ky6t5vdhkjm3dd9ej6arfd4jszh5rdq">inventore veritatis</a> et quasi architecto beatae vitae dicta sunt explicabo. <span className={settings.showHighlights !== false && settings.defaultHighlightVisibilityNostrverse !== false ? `content-highlight-${settings.highlightStyle || 'marker'} level-nostrverse` : ""}>Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.</span> Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.</p>
        </div>
      </div>
    </div>
  )
}

export default ReadingDisplaySettings

