# Markr

A minimal nostr client for bookmark management, built with [applesauce](https://github.com/hzrd149/applesauce).

## Features

- **Nostr Authentication**: Connect using your nostr account
- **Bookmark Display**: View your nostr bookmarks as per [NIP-51](https://github.com/nostr-protocol/nips/blob/master/51.md)
- **Minimal UI**: Clean, simple interface focused on bookmark management

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm, pnpm, or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd markr
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
│   ├── Login.tsx      # Authentication component
│   └── Bookmarks.tsx  # Bookmark display component
├── App.tsx            # Main application component
├── main.tsx           # Application entry point
└── index.css          # Global styles
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

## Contributing

This is a minimal MVP. Future enhancements could include:

- Bookmark creation and editing
- Bookmark organization and tagging
- Search functionality
- Export capabilities
- Mobile-responsive design improvements

## License

MIT

