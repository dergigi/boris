# Boris

A minimal nostr client for bookmark management, built with [applesauce](https://github.com/hzrd149/applesauce).

## Features

- **Nostr Authentication**: Connect using your nostr account via browser extension
- **Bookmark Display**: View your nostr bookmarks as per [NIP-51](https://github.com/nostr-protocol/nips/blob/master/51.md)
- **Content Classification**: Automatically detect and classify URLs (articles, videos, YouTube, images)
- **Reader Mode**: View article content inline with readable formatting
- **Collapsible Sidebar**: Expand/collapse bookmark list for focused reading
- **Profile Integration**: Display user profile images using applesauce ProfileModel
- **Relative Timestamps**: Human-friendly time display (e.g., "2 hours ago")
- **Event Links**: Quick access to view bookmarks on search.dergigi.com
- **Private Bookmarks**: Support for Amethyst-style hidden/encrypted bookmarks
- **Minimal UI**: Clean, modern interface focused on bookmark management

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm, pnpm, or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd boris
```

2. Install dependencies:
```bash
npm install
# or
pnpm install
# or
yarn install
```

3. Start the development server:
```bash
npm run dev
# or
pnpm dev
# or
yarn dev
```

4. Open your browser and navigate to `http://localhost:3000`

## Usage

1. **Connect**: Click "Connect with Nostr" to authenticate using your nostr account
2. **View Bookmarks**: Once connected, you'll see all your nostr bookmarks
3. **Navigate**: Click on bookmark URLs to open them in a new tab

## Technical Details

- Built with React and TypeScript
- Uses [applesauce-core](https://github.com/hzrd149/applesauce) for nostr functionality
- Implements [NIP-51](https://github.com/nostr-protocol/nips/blob/master/51.md) for bookmark management
- Supports both individual bookmarks and bookmark lists

## Development

### Project Structure

```
src/
├── components/
│   ├── Login.tsx                        # Authentication component
│   ├── Bookmarks.tsx                    # Main bookmarks view with layout
│   ├── BookmarkList.tsx                 # Bookmark list sidebar
│   ├── BookmarkItem.tsx                 # Individual bookmark card
│   ├── SidebarHeader.tsx                # Header bar with collapse, profile, logout
│   ├── ContentPanel.tsx                 # Content viewer panel
│   ├── IconButton.tsx                   # Reusable icon button component
│   ├── ContentWithResolvedProfiles.tsx  # Profile mention resolver
│   ├── ResolvedMention.tsx              # Nostr mention component
│   └── kindIcon.ts                      # Kind-specific icon mapping
├── services/
│   ├── bookmarkService.ts               # Main bookmark fetching orchestration
│   ├── bookmarkProcessing.ts            # Decryption and processing pipeline
│   ├── bookmarkHelpers.ts               # Shared types, guards, and utilities
│   ├── bookmarkEvents.ts                # Event type handling and deduplication
│   └── readerService.ts                 # Content extraction via reader API
├── types/
│   ├── bookmarks.ts                     # Bookmark type definitions
│   ├── nostr.d.ts                       # Nostr type augmentations
│   └── relative-time.d.ts               # relative-time package types
├── utils/
│   ├── bookmarkUtils.tsx                # Bookmark rendering utilities
│   └── helpers.ts                       # General helper functions
├── App.tsx                              # Main application component
├── main.tsx                             # Application entry point
└── index.css                            # Global styles
```

### Private (hidden) bookmarks (Amethyst-style)

We support Amethyst-style private (hidden) bookmark lists alongside public ones (NIP‑51):

- **Detection and unlock**
  - Use `Helpers.hasHiddenTags(evt)` and `Helpers.isHiddenTagsLocked(evt)` to detect hidden tags.
  - First try `Helpers.unlockHiddenTags(evt, signer)`; if that fails, try with `'nip44'`.
  - For events with encrypted `content` that aren’t recognized as supporting hidden tags (e.g. kind 30001), manually decrypt:
    - Prefer `signer.nip44.decrypt(evt.pubkey, evt.content)`, fallback to `signer.nip04.decrypt(evt.pubkey, evt.content)`.

- **Parsing and rendering**
  - Decrypted `content` is JSON `string[][]` (tags). Convert with `Helpers.parseBookmarkTags(hiddenTags)`.
  - Map to `IndividualBookmark[]` via our `processApplesauceBookmarks(..., isPrivate=true)` and append to the private list so they render immediately alongside public items.

- **Caching for downstream helpers**
  - Cache manual results on the event with `BookmarkHiddenSymbol` and also store the decrypted blob under `EncryptedContentSymbol` to aid debugging and hydration.

- **Structure**
  - `src/services/bookmarkService.ts`: orchestrates fetching, hydration, and assembling the final bookmark payload.
  - `src/services/bookmarkProcessing.ts`: decryption/collection pipeline (unlock, manual decrypt, parse, merge).
  - `src/services/bookmarkHelpers.ts`: shared types, guards, mapping, hydration, and symbols.
  - `src/services/bookmarkEvents.ts`: event type and de‑duplication for NIP‑51 lists/sets.

- **Notes**
  - We avoid `any` via narrow type guards for `nip44`/`nip04` decrypt functions.
  - Files are kept small and DRY per project rules.
  - Built on applesauce helpers (`Helpers.getPublicBookmarks`, `Helpers.getHiddenBookmarks`, etc.). See applesauce docs: https://hzrd149.github.io/applesauce/typedoc/modules.html

### Building for Production

```bash
npm run build
# or
pnpm build
# or
yarn build
```

## TODO

### High Priority
- [ ] **Mobile Responsive Design**: Optimize sidebar and content panel for mobile devices
- [ ] **Keyboard Shortcuts**: Add keyboard navigation (collapse sidebar, navigate bookmarks)
- [ ] **Search & Filter**: Add ability to search bookmarks by title, URL, or content
- [ ] **Error Handling**: Improve error states and retry logic for failed fetches
- [ ] **Loading States**: Better skeleton screens and loading indicators

### Medium Priority
- [ ] **Bookmark Creation**: Add ability to create new bookmarks
- [ ] **Bookmark Editing**: Edit existing bookmark metadata and tags
- [ ] **Bookmark Deletion**: Remove bookmarks from lists
- [ ] **Sorting Options**: Sort by date, title, kind, or custom order
- [ ] **Bulk Actions**: Select and perform actions on multiple bookmarks
- [ ] **Video Embeds**: Inline YouTube and video playback for video bookmarks

### Nice to Have
- [ ] **Dark/Light Mode Toggle**: User preference for color scheme
- [ ] **Export Functionality**: Export bookmarks as JSON, CSV, or HTML
- [ ] **Import Bookmarks**: Import from browser bookmarks or other formats
- [ ] **Tags & Categories**: Better organization with custom tags
- [ ] **Bookmark Collections**: Create and manage custom bookmark collections
- [ ] **Offline Support**: Cache bookmarks for offline viewing
- [ ] **Share Bookmarks**: Generate shareable links to bookmark lists
- [ ] **Performance Optimization**: Virtual scrolling for large bookmark lists
- [ ] **Browser Extension**: Quick bookmark saving from any page

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. Make sure to:

- Follow the existing code style
- Keep files under 210 lines
- Use conventional commits
- Run linter and type checks before submitting

## License

MIT

