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

