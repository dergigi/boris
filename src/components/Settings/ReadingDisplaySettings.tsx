import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHighlighter, faUnderline, faNetworkWired, faUserGroup, faUser } from '@fortawesome/free-solid-svg-icons'
import { UserSettings } from '../../services/settingsService'
import IconButton from '../IconButton'
import ColorPicker from '../ColorPicker'
import FontSelector from '../FontSelector'
import { getFontFamily } from '../../utils/fontLoader'
import { hexToRgb } from '../../utils/colorHelpers'

interface ReadingDisplaySettingsProps {
  settings: UserSettings
  onUpdate: (updates: Partial<UserSettings>) => void
}

const ReadingDisplaySettings: React.FC<ReadingDisplaySettingsProps> = ({ settings, onUpdate }) => {
  const previewFontFamily = getFontFamily(settings.readingFont || 'source-serif-4')

  return (
    <div className="settings-section">
      <h3 className="section-title">Reading & Display</h3>
      
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="setting-group setting-inline" style={{ flex: '1 1 auto', minWidth: '200px' }}>
          <label htmlFor="readingFont">Reading Font</label>
          <div className="setting-control">
            <FontSelector
              value={settings.readingFont || 'source-serif-4'}
              onChange={(font) => onUpdate({ readingFont: font })}
            />
          </div>
        </div>

        <div className="setting-group setting-inline" style={{ flex: '0 1 auto' }}>
          <label>Font Size</label>
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
        <label className="setting-label">My Highlights</label>
        <div className="setting-control">
          <ColorPicker
            selectedColor={settings.highlightColorMine || '#ffff00'}
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

      <div className="setting-group setting-inline">
        <label>Default Highlight Visibility</label>
        <div className="highlight-level-toggles">
          <button
            onClick={() => onUpdate({ defaultHighlightVisibilityNostrverse: !(settings.defaultHighlightVisibilityNostrverse !== false) })}
            className={`level-toggle-btn ${(settings.defaultHighlightVisibilityNostrverse !== false) ? 'active' : ''}`}
            title="Nostrverse highlights"
            aria-label="Toggle nostrverse highlights by default"
            style={{ color: (settings.defaultHighlightVisibilityNostrverse !== false) ? 'var(--highlight-color-nostrverse, #9333ea)' : undefined }}
          >
            <FontAwesomeIcon icon={faNetworkWired} />
          </button>
          <button
            onClick={() => onUpdate({ defaultHighlightVisibilityFriends: !(settings.defaultHighlightVisibilityFriends !== false) })}
            className={`level-toggle-btn ${(settings.defaultHighlightVisibilityFriends !== false) ? 'active' : ''}`}
            title="Friends highlights"
            aria-label="Toggle friends highlights by default"
            style={{ color: (settings.defaultHighlightVisibilityFriends !== false) ? 'var(--highlight-color-friends, #f97316)' : undefined }}
          >
            <FontAwesomeIcon icon={faUserGroup} />
          </button>
          <button
            onClick={() => onUpdate({ defaultHighlightVisibilityMine: !(settings.defaultHighlightVisibilityMine !== false) })}
            className={`level-toggle-btn ${(settings.defaultHighlightVisibilityMine !== false) ? 'active' : ''}`}
            title="My highlights"
            aria-label="Toggle my highlights by default"
            style={{ color: (settings.defaultHighlightVisibilityMine !== false) ? 'var(--highlight-color-mine, #eab308)' : undefined }}
          >
            <FontAwesomeIcon icon={faUser} />
          </button>
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
            '--highlight-rgb': hexToRgb(settings.highlightColor || '#ffff00')
          } as React.CSSProperties}
        >
          <h3>The Quick Brown Fox</h3>
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. <span className={settings.showHighlights !== false && settings.defaultHighlightVisibilityMine !== false ? `content-highlight-${settings.highlightStyle || 'marker'} level-mine` : ""}>Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</span> Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
          <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. <span className={settings.showHighlights !== false && settings.defaultHighlightVisibilityFriends !== false ? `content-highlight-${settings.highlightStyle || 'marker'} level-friends` : ""}>Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</span> Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.</p>
          <p>Totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. <span className={settings.showHighlights !== false && settings.defaultHighlightVisibilityNostrverse !== false ? `content-highlight-${settings.highlightStyle || 'marker'} level-nostrverse` : ""}>Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.</span> Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.</p>
          <p>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.</p>
        </div>
      </div>
    </div>
  )
}

export default ReadingDisplaySettings

