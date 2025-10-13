# Boris Color System

All colors now use Tailwind CSS color palette for consistency and maintainability.

## Semantic Color Aliases (Tailwind Config)

```javascript
'app-bg': '#18181b',           // zinc-900 - Main backgrounds
'app-bg-elevated': '#27272a',  // zinc-800 - Elevated surfaces (cards, modals)
'app-bg-subtle': '#1e1e1e',    // Custom ~zinc-850 - Subtle backgrounds
'app-border': '#3f3f46',       // zinc-700 - Primary borders
'app-border-subtle': '#52525b', // zinc-600 - Subtle borders
'app-text': '#e4e4e7',         // zinc-200 - Primary text
'app-text-secondary': '#a1a1aa', // zinc-400 - Secondary text
'app-text-muted': '#71717a',   // zinc-500 - Muted text
'primary': '#6366f1',          // indigo-500 - Primary accent
'primary-hover': '#4f46e5',    // indigo-600 - Primary hover state
'highlight-mine': '#fde047',   // yellow-300 - User highlights
'highlight-friends': '#f97316', // orange-500 - Friends highlights
'highlight-nostrverse': '#9333ea', // purple-600 - Nostrverse highlights
```

## Highlight Colors (User-Settable)

Default colors in the color picker:
- **Yellow** (default): `#fde047` - yellow-300
- **Orange**: `#f97316` - orange-500
- **Pink**: `#ec4899` - pink-500
- **Green**: `#22c55e` - green-500
- **Blue**: `#3b82f6` - blue-500
- **Purple**: `#9333ea` - purple-600

## Common Color Mappings

| Old Hex   | Tailwind Color | Usage |
|-----------|----------------|-------|
| `#18181b` | zinc-900       | Main app background |
| `#1a1a1a` | zinc-900       | Component backgrounds |
| `#1e1e1e` | ~zinc-850      | Code blocks, subtle surfaces |
| `#252525` | zinc-800       | Hover states |
| `#27272a` | zinc-800       | Elevated surfaces |
| `#2a2a2a` | zinc-800       | Buttons, inputs |
| `#333`    | zinc-700       | Primary borders |
| `#3f3f46` | zinc-700       | Component borders |
| `#444`    | zinc-600       | Subtle borders |
| `#52525b` | zinc-600       | Input borders |
| `#555`    | zinc-500       | Hover borders |
| `#666`    | zinc-500       | Muted text |
| `#71717a` | zinc-500       | Secondary text |
| `#888`    | zinc-400       | Secondary text |
| `#999`    | zinc-400       | Muted labels |
| `#a1a1aa` | zinc-400       | Placeholder text |
| `#aaa`    | zinc-300       | Light text |
| `#ccc`    | zinc-300       | Primary text on dark |
| `#ddd`    | zinc-200       | Bright text |
| `#e4e4e7` | zinc-200       | Primary text |
| `#646cff` | indigo-500     | Primary accent |
| `#535bf2` | indigo-600     | Primary hover |
| `#fde047` | yellow-300     | Default highlight (brighter) |
| `#f97316` | orange-500     | Friends highlights |
| `#9333ea` | purple-600     | Nostrverse highlights |

## Usage Guidelines

### In CSS
Use Tailwind utilities whenever possible:
```css
.example {
  background: rgb(24 24 27); /* zinc-900 */
  border: 1px solid rgb(63 63 70); /* zinc-700 */
  color: rgb(228 228 231); /* zinc-200 */
}
```

### In TSX
Use Tailwind classes:
```tsx
<div className="bg-zinc-900 border border-zinc-700 text-zinc-200">
```

Or semantic aliases:
```tsx
<div className="bg-app-bg border border-app-border text-app-text">
```

### CSS Variables (User-Settable)
For colors that users can customize:
```css
background: var(--highlight-color-mine, #fde047);
```

## Notes

- All hex colors are now Tailwind palette colors
- CSS variables remain for user-customizable colors
- Semantic aliases provide easier maintenance
- RGB format in CSS allows for opacity control

