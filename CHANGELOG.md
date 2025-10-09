# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.4] - 2025-10-09

### Fixed
- Add p tag (author tag) to highlights of nostr-native content for proper attribution

## [0.3.3] - 2025-10-09

### Added
- Service Worker for robust offline image caching
- /explore route to discover blog posts from friends on Nostr
- Explore button (newspaper icon) in bookmarks header
- "Connecting" status indicator on page load (instead of immediately showing "Offline")
- Last fetch time display with relative timestamps in bookmarks list

### Changed
- Simplify image caching to use Service Worker transparently
- Move refresh button from top bar to end of bookmarks list
- Make explore page article cards proper links (supports CMD+click to open in new tab)
- Reorganize bookmarks UI for better UX

### Fixed
- Improve image cache resilience for offline viewing and hard reloads
- Correct TypeScript types for cache stats state
- Resolve linter errors for unused parameters
- Import useEventModel from applesauce-react/hooks for proper type safety
- Import Models from applesauce-core instead of applesauce-react
- Use correct useEventModel hook for profile loading in BlogPostCard

## [0.3.0] - 2025-10-09

### Added
- Flight Mode with offline highlight creation and local relay support
- Automatic offline sync - rebroadcast local events when back online
- Relay indicator icon on highlight items showing sync status
- Click-to-rebroadcast functionality for highlights
- Flight mode indicator (plane icon) on offline-created highlights
- Relay rebroadcast settings for caching and propagation
- Local relay status indicator for local-only/offline mode
- Second local relay support (localhost:4869)
- Relay connection status tracking and display
- 6th font size option for better UI scaling

### Fixed
- Highlight creation resilient to offline/flight mode
- TypeScript type errors in offline sync
- Relay indicator tooltip accuracy and reliability
- Always show relay indicator icon on highlights
- Show remote relay list for fetched highlights
- Publish highlights to all connected relays instead of just one
- Keep all relay connections alive, not just local ones
- Check actual relay connection status instead of pool membership
- Skip rebroadcasting when in flight mode
- Update relay info after automatic sync completes
- Only show successfully reachable relays in flight mode
- Include local relays in relay indicator tooltip

### Changed
- Rename 'Offline Mode' to 'Flight Mode' throughout UI
- Move publication date to top-right corner with subtle border styling
- Consolidate relay/status indicators into single unified icon
- Simplify relay indicator tooltip to show relay list
- Move rebroadcast settings to dedicated Flight Mode section
- Place Reading Font and Font Size settings side-by-side
- Improve font size scale and default value
- Use wifi icon for disconnected remote relays
- Use airplane icons for local relay indicators
- Make Relays heading same level as Flight Mode in settings
- Simplify rebroadcast settings UI with consistent checkbox style

### Performance
- Make highlight creation instant with non-blocking relay publish
- Reduce relay status polling interval to 20 seconds
- Show sync progress and hide indicator after successful sync

## [0.2.10] - 2025-10-09

### Added
- URL-based settings navigation with /settings route
- Active zap split preset highlighting
- Educational links about relays in reader view
- Article publication date display in reader
- Local relay recommendations in settings
- Relays section showing active and recently connected relays

### Fixed
- Remove trailing slash from relay URLs
- Constrain Reading Font dropdown width

### Changed
- Rename 'Default View Mode' to 'Default Bookmark View' in settings
- Reorganize settings layout for better UX
- Use sidebar-style colored buttons for highlight visibility
- Simplify Relays section presentation

## [0.2.9] - 2025-10-09

### Fixed
- Deduplicate highlights in streaming callbacks

## [0.2.8] - 2025-10-09

### Added
- Display article summary in header
- Overlay title and metadata on hero images
- Apply reading font to article titles

### Fixed
- Pass article summary through to ReadableContent
- Correct Jina AI Reader proxy URL format

### Changed
- Update homepage URL to read.withboris.com
- Reorder toolbar buttons for better UX

## [0.2.7] - 2025-10-08

### Added
- Web bookmark creation (NIP-B0, kind:39701)
- Tags support for web bookmarks per NIP-B0
- Auto-fetch title and description when URL is pasted
- Prioritize OpenGraph tags for metadata extraction
- Auto-extract tags from metadata with boris as default tag
- Zap split preset buttons
- Boris support percentage to zap splits
- Respect existing zap tags in source content when creating highlights

### Fixed
- Revert to fetchReadableContent to avoid CORS issues
- Improve modal spacing with proper box-sizing
- Prevent sliders from jumping when resetting settings
- Pass relayPool as prop instead of using non-existent hook
- Correct type signature for addZapTags function

### Changed
- Reorder toolbar buttons for better UX
- DRY up tag extraction with normalizeTags helper
- Use url-metadata package for robust metadata extraction
- Make zap split sliders independent using weights
- Move zap splits to dedicated settings section
- Publish bookmarks to relays in background for better performance

## [0.2.6] - 2025-10-08

### Added
- Home button to bookmark bar
- Configurable zap split for highlights on nostr-native content

## [0.2.5] - 2025-10-07

### Fixed
- Wire preview ref to markdown conversion hook
- Add missing useEffect dependencies for article loading

### Changed
- DRY up highlight classification and URL normalization
- Split highlighting utilities into modules
- Extract highlights panel components
- Extract content rendering hooks
- Split Settings into section components
- Extract event processing utilities
- Split Bookmarks.tsx into smaller hooks and components

## [0.2.4] - 2025-10-07

### Added
- Domain configuration for https://xn--bris-v0b.com/
- Public assets and deployment configuration
- Hide bookmarks without content or URL

### Fixed
- Encode/decode URLs in /r/ route to preserve special characters

### Changed
- Cleanup after build fixes (remove shims, update locks)
- Stop tracking node_modules/dist
- Update dependencies and dedupe
- Add .gitignore for node_modules and dist

## [0.2.3] - 2025-10-07

### Added
- Parse and display summary tag for nostr articles
- Merge and flatten bookmarks from multiple lists
- Update URL path when opening bookmarks from sidebar

### Fixed
- Ensure bookmarks are sorted newest first after merging lists
- Hide empty bookmarks without content
- Remove encrypted cyphertext display from bookmark list

### Changed
- Remove created date from bookmark list display

## [0.2.2] - 2025-10-06

### Added
- Support for web bookmarks (NIP-B0, kind:39701)
- Default highlight visibility settings
- Proxy.nostr-relay.app relay to configuration
- Comprehensive logging to settings service

### Fixed
- Handle web bookmarks with URLs in d tag and prevent crash
- Load settings from local cache first to eliminate FOUT
- Ensure fonts are fully loaded before applying styles
- Improve highlight rendering pipeline with comprehensive debugging

### Changed
- Use icon toggle buttons for highlight visibility settings
- Change nostrverse icon from fa-globe to fa-network-wired

## [0.2.1] - 2025-10-05

### Added
- Local relay support and centralize relay configuration
- Optimistic updates for highlight creation
- Enable highlight creation from external URLs
- Add routing support for external URLs
- Add context to highlights (previous and next sentences)
- Boris branding to highlight alt tag

### Fixed
- Properly await account loading from localStorage on refresh
- Add protected routes to prevent logout on page refresh
- Use undo icon for reset to defaults button
- Update local relay port to 10547

### Changed
- Remove dedicated login page, handle login through main UI
- Simplify to single RELAYS constant (DRY)

## [0.2.0] - 2025-10-05

### Added
- Simple highlight creation feature (FAB style)
- Reset to defaults button in settings
- Load and apply settings upon login

### Fixed
- Replace any types with proper NostrEvent types
- Move FAB to Bookmarks component for proper floating
- Highlight button positioning with scroll

### Changed
- Update color palette to include default friends/nostrverse colors
- Show author name in highlight cards
- Sync highlight level toggles between sidebar and main article text
- Rename 'underlines' to 'highlights' throughout codebase

## [0.1.11] - 2025-10-05

### Added
- Stream highlights progressively as they arrive from relays

### Fixed
- Display article immediately without waiting for highlights to load
- Show highlights immediately when opening panel if already loaded
- Prevent bookmark text from being cut off in compact view
- Correct default highlight color for 'mine' to yellow (#ffff00)

### Changed
- Reduce padding between bookmark items and panel edge
- Update default highlight colors to orange for friends and purple for nostrverse

## [0.1.10] - 2025-10-05

### Added
- Three-level highlight system (mine/friends/nostrverse)

### Fixed
- Ensure highlights always render on markdown content
- Classify highlights before passing to ContentPanel
- Position toggle buttons directly adjacent to main panel
- Remove redundant setReaderLoading call in error handler

### Changed
- Always show friends and user highlight buttons
- Remove Highlights title and count from panel

## [0.1.9] - 2025-10-05

### Fixed
- Show markdown content immediately when finalHtml is empty
- Prevent highlight bleeding into sidebar

## [0.1.8] - 2025-10-05

### Fixed
- Prevent 'No readable content' flash for markdown articles
- Enable highlights display and scroll-to for markdown content

### Added
- Persist accounts to localStorage

### Changed
- Simplify login by handling it directly in sidebar

## [0.1.7] - 2025-10-05

### Added
- Show highlights in article content and add mode toggle

### Fixed
- Show highlights for nostr articles by skipping URL filter
- Refresh button now works without login for article highlights
- Query highlights using both a-tag and e-tag

### Changed
- Keep Bookmarks.tsx under 210 lines by extracting logic

## [0.1.6] - 2025-10-03

### Added
- Native support for rendering Nostr long-form articles (NIP-23)
- Display article titles for kind:30023 bookmarks
- Enable clicking on kind:30023 articles to open in reader
- Display article hero images in bookmark views and reader
- Configurable highlight colors
- Highlight style setting (marker & underline)

### Fixed
- Use bookmark pubkey for article author instead of tag lookup
- Ensure highlight color CSS variable inherits from parent

### Changed
- Integrate long-form article rendering into existing reader view
- Extract components to keep files under 210 lines
- Make font size and color buttons match icon button size (33px)

## [0.1.5] - 2025-10-03

### Added
- Settings panel with NIP-78 storage
- Auto-save for settings with toast notifications
- Reading time estimate to articles
- Font size setting
- Configurable reading font using Bunny Fonts
- Live preview of reading font in settings
- Settings subscription to watch for Nostr updates

### Fixed
- Prevent settings from saving unnecessarily
- Prevent save settings button from being cut off
- Replace custom reading time with reading-time-estimator package
- Update originalHtmlRef when content changes

### Changed
- Reduce file sizes to meet 210 line limit
- Extract settings logic into custom hook
- Consolidate settings initialization on login
- Remove debounce from settings auto-save

## [0.1.4] - 2025-10-03

### Added
- Inline highlight annotations in content panel
- NIP-84 highlights panel with three-pane layout
- Toggle button to show/hide highlight underlines
- Click-to-scroll for highlights
- Pulsing animation when scrolling to highlight

### Fixed
- Apply highlights to markdown content as well as HTML
- Use requestAnimationFrame for highlight DOM manipulation
- Improve HTML highlight matching with DOM manipulation
- Filter highlights panel to show only current article

### Changed
- Use applesauce helpers for highlight parsing
- DRY up highlightMatching to stay under 210 lines
- Change highlights to fluorescent marker style
- Deduplicate highlight events by ID

## [0.1.3] - 2025-10-03

### Added
- View mode switching for bookmarks with compact list view
- Large preview view mode
- Image preview for large view cards
- Hero images using free CORS proxy

### Changed
- Make entire compact list row clickable to open reader
- Make card view timestamp clickable to open event
- Enhance card view design with modern styling

## [0.1.2] - 2025-10-03

### Added
- Open bookmark URLs in reader instead of new window
- localStorage caching for fetched articles
- Collapsible bookmarks sidebar

### Fixed
- Make sidebar and reader scroll independently
- Replace relative-time with date-fns for timestamp formatting

### Changed
- Display timestamps as relative time
- Replace user text with profile image in sidebar header
- Move user info and logout to sidebar header bar
- Reduce IconButton size by 25%

## [0.1.1] - 2025-10-03

### Added
- Classify URLs by type and adjust action buttons
- Collapse/expand functionality for bookmarks sidebar
- IconButton component with square styling
- Resolve nprofile/npub mentions to names in content

### Fixed
- Enforce 210-char truncation for both plain and parsed content
- Use Rules of Hooks correctly

### Changed
- Use IconButton for all icon-only actions to enforce square sizing
- Sort bookmarks by added_at (recently added first)
- Make kind icon square to match IconButton sizing
- Remove colored borders and gradients; keep neutral cards

## [0.1.0] - 2025-10-03

### Added
- Two-pane layout and content fetching pipeline
- ContentPanel component to render readable HTML
- Lightweight readability fetcher via r.jina.ai proxy
- Markdown rendering support with react-markdown and remark-gfm
- READ NOW button to bookmark cards
- Spinner to content loading state
- FontAwesome icons for event kinds

### Fixed
- Show bookmarked event author instead of list signer
- Enable reactive profile fetch via address loader
- Left-align content and constrain images in content panel

### Changed
- Resolve author names using applesauce ProfileModel
- Propagate URL selection through BookmarkList to parent
- Display URLs clearly in individual bookmarks

## [0.0.3] - 2025-10-02

### Added
- Manual decryption for unrecognized event kinds
- Try NIP-44 then NIP-04 for manual decryption
- Detailed debugging for decryption process
- Support for hidden bookmarks decryption

### Fixed
- Surface manually decrypted hidden tags in UI
- Dedupe individual bookmarks by id

### Changed
- Sort individual bookmarks by timestamp (newest first)
- Increase bookmark loading timeout by 2x
- Extract helpers and event processing

## [0.0.2] - 2025-10-02

### Added
- Fetch all NIP-51 events
- Unlock private bookmarks via applesauce helpers
- Copy-to-clipboard icons for event id and author pubkey
- FontAwesome globe/lock icons
- Display content identically for private/public bookmarks

### Fixed
- Properly configure browser extension signer
- Aggregate list(10003) + set(30001)
- Handle applesauce bookmark structure correctly
- Resolve loading state stuck issue

### Changed
- Change bookmarks display from grid to social feed list layout
- Simplify bookmark service using applesauce helpers
- Extract components and utilities to keep files under 210 lines

## [0.0.1] - 2025-10-02

### Added
- Initial release
- Browser extension login support
- NIP-51 bookmark fetching from nostr relays
- User profile display
- Relay pool configuration
- Basic UI with profile resolution

### Changed
- Migrate to applesauce-accounts for proper account management
- Use proper applesauce-loaders for NIP-51 bookmark fetching
- Optimize relay usage following applesauce-relay best practices
- Use applesauce-react event models for better profile handling

[0.3.4]: https://github.com/dergigi/boris/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/dergigi/boris/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/dergigi/boris/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/dergigi/boris/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/dergigi/boris/compare/v0.2.10...v0.3.0
[0.2.10]: https://github.com/dergigi/boris/compare/v0.2.9...v0.2.10
[0.2.9]: https://github.com/dergigi/boris/compare/v0.2.8...v0.2.9
[0.2.8]: https://github.com/dergigi/boris/compare/v0.2.7...v0.2.8
[0.2.7]: https://github.com/dergigi/boris/compare/v0.2.6...v0.2.7
[0.2.6]: https://github.com/dergigi/boris/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/dergigi/boris/compare/v0.2.4...v0.2.5
[0.2.4]: https://github.com/dergigi/boris/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/dergigi/boris/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/dergigi/boris/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/dergigi/boris/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/dergigi/boris/compare/v0.1.11...v0.2.0
[0.1.11]: https://github.com/dergigi/boris/compare/v0.1.10...v0.1.11
[0.1.10]: https://github.com/dergigi/boris/compare/v0.1.9...v0.1.10
[0.1.9]: https://github.com/dergigi/boris/compare/v0.1.8...v0.1.9
[0.1.8]: https://github.com/dergigi/boris/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/dergigi/boris/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/dergigi/boris/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/dergigi/boris/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/dergigi/boris/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/dergigi/boris/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/dergigi/boris/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/dergigi/boris/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/dergigi/boris/compare/v0.0.3...v0.1.0
[0.0.3]: https://github.com/dergigi/boris/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/dergigi/boris/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/dergigi/boris/releases/tag/v0.0.1

