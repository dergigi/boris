import React, { useMemo } from 'react'
import { faHighlighter, faUnderline } from '@fortawesome/free-solid-svg-icons'
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
      
      <div className="setting-group setting-inline">
        <label htmlFor="readingFont">Reading Font</label>
        <FontSelector
          value={settings.readingFont || 'source-serif-4'}
          onChange={(font) => onUpdate({ readingFont: font })}
        />
      </div>

      <div className="setting-group setting-inline">
        <label>Font Size</label>
        <div className="setting-buttons">
          {[14, 16, 18, 20, 22].map(size => (
            <button
              key={size}
              onClick={() => onUpdate({ fontSize: size })}
              className={`font-size-btn ${(settings.fontSize || 18) === size ? 'active' : ''}`}
              title={`${size}px`}
              style={{ fontSize: `${size - 2}px` }}
            >
              A
            </button>
          ))}
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

      <div className="setting-preview">
        <div className="preview-label">Preview</div>
        <div 
          className="preview-content" 
          style={{ 
            fontFamily: previewFontFamily,
            fontSize: `${settings.fontSize || 18}px`,
            '--highlight-rgb': hexToRgb(settings.highlightColor || '#ffff00')
          } as React.CSSProperties}
        >
          <h3>The Quick Brown Fox</h3>
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. <span className={settings.showHighlights !== false ? `content-highlight-${settings.highlightStyle || 'marker'} level-mine` : ""}>Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</span> Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
          <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. <span className={settings.showHighlights !== false ? `content-highlight-${settings.highlightStyle || 'marker'} level-friends` : ""}>Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</span> Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.</p>
          <p>Totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. <span className={settings.showHighlights !== false ? `content-highlight-${settings.highlightStyle || 'marker'} level-nostrverse` : ""}>Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.</span> Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.</p>
          <p>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.</p>
        </div>
      </div>
    </div>
  )
}

export default ReadingDisplaySettings

