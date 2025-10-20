# Boris Features
## Overview

- **Purpose**: A calm, fast, Nostr‑first reader that turns your bookmarks into a focused reading app.
- **Layout**: Three‑pane interface — bookmarks (left), reader (center), highlights (right). Collapsible sidebars.
- **Content**: Renders both Nostr long‑form posts (kind:30023) and regular web URLs.
- **Social layer**: Highlights shown by level — mine, friends, nostrverse — each with its own color and visibility toggle.

## Reader Experience

- **Distraction‑free view**: Clean typography, optional hero image, summary, and published date.
- **Reading time**: Displays estimated reading time for text or duration for supported videos.
- **Progress**: Reading progress indicator with completion state.
- **Text‑to‑Speech**: Listen to articles with browser‑native TTS; play/pause/stop controls with adjustable speed (0.8–1.6x).
- **Menus**: Quick actions to open, share, or copy links (for both Nostr and web content).
- **Performance**: Lightweight fetching and caching for speed; skeleton loaders to avoid empty flashes.

## Highlights (NIP‑84)

- **Levels**: Mine, friends, nostrverse; toggle per level; colors configurable in settings.
- **Interactions**: Click a highlight to scroll to its position; count indicator in the header.
- **Creation**: Select text and use the floating highlighter button to publish a highlight.
- **Attribution**: Automatically tags article authors for Nostr posts so they can see highlights.

## Zap Splits (NIP‑57)

- **Configurable splits**: Weight‑based sliders for highlighter, author(s), and Boris (defaults 50/50/2.1).
- **Presets**: Quick buttons for common split configurations.
- **Respect source**: If the source article has zap tags, author weights are proportionally preserved.

## Bookmarks & Reading List (NIP‑51 + Web)

- **Ingestion**: Collects list bookmarks and items from kinds 10003/30003/30001.
- **Web bookmarks**: Supports NIP‑B0 (kind:39701) for standalone URL bookmarks.
- **Add Bookmark**: Modal with auto title/description extraction and keywords/tags suggestion (adds “boris” when helpful).
- **Views**: Reading list in compact, cards, or large preview modes; quick toggles to switch.
- **Archive**: “Read” items appear in your archive; can mark articles/web pages as read.

## Explore & Profiles

- **Explore**: Discover friends' highlights and writings, plus a "nostrverse" feed.
- **Filters**: Visibility toggles (mine, friends, nostrverse) apply to Explore highlights.
- **Profiles**: View your own (`/me`) or other users (`/p/:npub`) with tabs for Highlights, Bookmarks, Archive, and Writings.

## Support

- **Supporter page**: Displays avatars of users who zapped Boris (kind:9735 receipts).
- **Thresholds**: Shows supporters who sent ≥ 2100 sats; whales (≥ 69420 sats) get special styling with a bolt badge.
- **Profile integration**: Fetches and displays profile pictures and names for all supporters.
- **Stats**: Total supporter count and zap count displayed at the bottom.

## Video

- **Embedded player**: Plays supported videos (e.g., YouTube) inline with duration display.
- **Metadata**: Fetches YouTube title/description/transcript when available.
- **Deep links**: Open in native apps via platform‑specific URL schemes.

## Settings (NIP‑78 Application Data)

- **Theme**: System/light/dark with color variants (dark: black/midnight/charcoal; light: paper‑white/sepia/ivory).
- **Reading**: Font family (preloaded), font size, highlight style (marker/underline), per‑level colors.
- **Layout & startup**: Default view modes, auto‑collapse preferences, show/hide highlights.
- **Zap Splits**: Weight sliders and presets for NIP‑57 splits.
- **Offline/Flight Mode**: Local image cache with size limit and clear controls; “use local relay as cache”; rebroadcast preferences.
- **Relays**: Relay overview and status in Settings; educational links.
- **PWA**: Install prompt when available.

## Offline, PWA, and Sync

- **PWA**: Installable; service worker registered; periodic update checks with in‑app toast.
- **Flight Mode**: Operates with local relays only; highlights created offline are stored locally and synced later.
- **Relay indicator**: Floating status indicator shows Connecting/Offline/Flight Mode and connected counts.

## Relays & Accounts

- **Applesauce stack**: Accounts, event store, relay pool, and blueprints power Nostr interactions.
- **Multi‑relay**: Grouped connections with keep‑alive subscription; local+remote partitioning for fast queries.
- **Persistence**: Accounts restored from local storage; settings saved to NIP‑78 and watched for updates.

## Privacy

- **Identity**: No email or new account; uses your existing Nostr signer/identity.
- **Data**: Bookmarks and highlights live on Nostr; reading/rendering happens locally in your browser.

## Conveniences

- **Share/copy**: One‑click copy or share for articles and videos.
- **Open on Nostr**: Deep links to portals and `nostr:` schemes for long‑form articles.
- **Mobile UX**: Floating open buttons for Bookmarks/Highlights, focus trapping, and backdrop controls.

