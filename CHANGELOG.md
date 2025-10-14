# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.6] - 2025-10-14

### Added

- Profile fetching and caching for explore page
  - Automatically fetches kind:0 metadata for all blog post authors
  - Stores profiles in event store for instant access across app
  - Rebroadcasts profiles to local/all relays per user settings
  - Fixes "Unknown" author names by proactively caching profiles
- Rich content rendering in highlight comments
  - URLs automatically detected and rendered as clickable links
  - Image URLs (jpg, png, gif, webp, etc.) render as inline images
  - Images lazy-load with responsive sizing and rounded borders
  - Links open in new tab with security attributes

### Changed

- Hide citation in highlights sidebar when viewing article
  - Citation removed from sidebar since all highlights are from same source
  - Citation still shown in Explore and Me pages where context is needed
  - Reduces visual clutter and redundant information

### Fixed

- Blog posts with far-future publication dates no longer appear in explore
  - Filter excludes posts with dates more than 1 day in future
  - Allows 1 day tolerance for clock skew between systems
  - Prevents spam posts with unrealistic dates (e.g., "53585 years from now")
- Layout breaks from long URLs in highlight comments
  - Added word-wrap, overflow-wrap, and word-break CSS properties
  - Set min-width: 0 to allow flex child to shrink properly
  - Long URLs now wrap correctly instead of causing horizontal overflow
- Profile fetching implementation
  - Use eventStore.add() directly for immediate profile storage
  - Use tap() operator to process events as they arrive
  - Correct TypeScript types and dependency array

## [0.6.5] - 2025-10-14

### Added

- Highlights tab on `/explore` page
  - View highlights from friends and followed users
  - Tab structure matching `/me` and profile pages
  - Grid layout for highlights with cards
  - Highlights shown first, writings second
  - Clicking highlight opens source article and scrolls to position
  - Opens highlights sidebar automatically when clicking from explore
- Citation attribution on highlight items
  - Shows "— Author, Article Title" for Nostr-native content
  - Shows "— domain.com" for web URLs
  - Resolves author profiles and article titles automatically
- Comment icon (fa-comments) for highlights with comments
  - Flipped horizontally for better visual alignment
  - Colored based on highlight level (mine/friends/nostrverse)
  - No background or extra indent for cleaner look
- Click timestamp to open highlight in native Nostr app
  - Uses nostr:nevent links for native app integration

### Changed

- Highlight counter text color now matches article text (var(--color-text))
  - Better readability in both light and dark modes
  - Only forces white in overlay context (hero images)
- Highlight level colors applied to explore page highlights
  - Yellow for own highlights
  - Orange for friends' highlights
  - Purple for nostrverse highlights
- Explore page tab order: Highlights first, Writings second
- Explore page tabs now extend full width to match content grid

### Fixed

- Highlight counter readability in light mode
  - Theme-aware text color instead of hardcoded blue
  - Consistent with reading time indicator styling
- Scroll-to-highlight reliability in article view
  - Added retry mechanism for asynchronous content loading
  - Attempts to find highlight element up to 20 times over 2 seconds
- Author attribution in highlight citations
  - Correctly extracts author pubkey from highlight's p tag
  - No more "Unknown" author names
- Explore page grid layout
  - Removed max-width constraint blocking full-width display
  - Tabs and content now properly aligned

### Style

- Replaced server icon with highlighter icon in highlight items
- Switch from solid comment icon to outlined comments icon (fa-regular)
- Removed background from highlight comments for cleaner appearance
- Removed extra left margin from comments (icon provides sufficient indent)
- Comment icon colored by highlight level with no opacity

### Dependencies

- Added @fortawesome/free-regular-svg-icons package for outlined icons

## [0.6.4] - 2025-10-14

### Added

- Color theme variants for light and dark modes
  - Sepia, Classic (white/black), Rose, Sky, Mint, and Lavender themes
  - Color swatches shown in theme selector instead of text labels
  - CSS variable tokens and theme classes for consistent theming
- Playful empty state message for other users' profiles
- Profile links now open within app instead of external portals

### Changed

- Default light theme changed to sepia for better readability
- Theme setting labels renamed from 'Colors' to 'Theme'
- Highlight text now aligns properly with footer icons
- Increased spacing between highlight cards for better visual separation
- Increased bottom padding in highlight cards
- Simplified Me page tab labels for cleaner UI
- Highlight marker style applied to active Highlights tab
- All profile links open internally instead of via external Nostr portals
- Match highlight comment color to highlight level color

### Fixed

- Consistent yellow-300 highlight color across all themes
- Highlight contrast improved in light themes
- Text contrast improved in dark color themes
- Darker background for app body in dark themes
- Reading progress indicator now uses theme colors
- Highlights tab readability improved in light mode with proper background
- Empty state text color changed from red to gray for better aesthetics
- Replaced 'any' types with proper type definitions for better type safety

### Refactored

- Migrated entire codebase to semantic token system
  - Pull-to-refresh components updated to use semantic tokens
  - Cards, forms, and layout components migrated to semantic tokens
  - All remaining components converted to semantic token usage
- Removed localStorage for theme persistence, using only Nostr (NIP-78)
- Theme colors applied to body element for consistent theming

## [0.6.3] - 2025-10-14

### Added

- Ants link to empty writings state for other users

### Changed

- Empty state text color from red to gray

### Fixed

- Match highlight comment color to highlight level color
- Open all profile links within app instead of external portals
- Playful empty state message for other users' profiles

## [0.6.2] - 2025-01-27

### Added

- Pull-to-refresh gesture on mobile for all scrollable views
  - HighlightsPanel (right sidebar) - refresh highlights for current article
  - Explore page - refresh blog posts from friends
  - Me pages (all tabs) - refresh user data
  - BookmarkList (left sidebar) - refresh bookmarks
  - Touch-only activation using coarse pointer detection
  - Visual indicator with rotating arrow and contextual messages
- Three-dot menu for external URLs in reader (`/r/` path)
  - Open in browser, Copy URL, Share URL actions
  - Consistent with article menu functionality

### Changed

- Bookmark refresh button moved to footer alongside view mode controls
  - Last update time now shown in button tooltip
  - Cleaner UI with all controls consolidated in footer
- Unified button styles across left and right sidebars
  - All sidebar buttons now use IconButton component for consistency
  - Removed 73 lines of redundant CSS for old button classes
  - Highlights panel buttons match bookmark sidebar styling

### Fixed

- Reader content alignment on desktop
  - Title, summary, metadata, and body text now properly aligned
  - All reader elements now have consistent 2rem horizontal padding
  - Mobile layout retains compact padding
- Highlight text matching with multiple improvements
  - Precise normalized-to-original character position mapping
  - Remove existing highlight marks before applying new ones
  - Robust validation and error handling for multi-node highlights
  - Prevent character spacing issues in highlighted text
  - Add text validation before applying highlights
  - Eliminate intra-word spaces in highlighted text

## [0.6.1] - 2025-10-13

### Added

- Writings tab on `/me` page to display user's published articles
- Comprehensive headline styling (h1-h6) with Tailwind typography
- List styling for ordered and unordered lists in articles
- Blockquote styling with indentation and italics
- Vertical padding to blockquotes for better readability
- Horizontal padding for reader text content on desktop
- Drop-shadows to sidebars for visual depth
- MutationObserver for tracking highlight DOM changes

### Changed

- Article titles now larger and more prominent
- Article summaries now display properly in reader header
- Zap splits settings UI with preset buttons and full-width sliders
- Sidebars now extend to 100vh height
- Blockquote styling simplified to minimal indent and italic
- Improved zap splits settings visual design

### Fixed

- Horizontal overflow from code blocks and wide content on mobile
- Settings view now mobile-friendly with proper width constraints
- Long relay URLs no longer cause horizontal overflow on mobile
- Sidebar/highlights toggle buttons hidden on settings/explore/me pages
- Video titles now show filename instead of 'Error Loading Content'
- AddBookmarkModal z-index issue fixed using React Portal
- Highlight matching for text spanning multiple DOM nodes/inline elements
- Highlights now appear as single continuous element across DOM nodes
- Highlights display immediately after creation with synchronous render
- Scroll-to-highlight functionality restored after DOM updates
- Padding gaps around sidebars removed
- TypeScript errors in video-meta.ts resolved

### Refactored

- Migrated entire color system to Tailwind v4 color palette
- Migrated all CSS files (sidebar, highlights, cards, forms, reader, etc.) to Tailwind colors
- Updated default highlight colors to yellow-400 for markers and yellow-300 for other contexts
- Added comprehensive color system documentation (COLOR_SYSTEM.md)
- Cleaned up legacy.css removing unused debugging styles

## [0.6.0] - 2025-10-13

### Added

- Tailwind CSS v4 integration with preflight enabled
- Reading position tracking with visual progress indicator
- Document-level scrolling with sticky sidebars on desktop
- Dedicated legacy styles file for better organization

### Changed

- Refactored layout system to use document scroll instead of pane scroll
- Migrated reading progress indicator to Tailwind utilities
- Migrated mobile buttons to Tailwind utilities
- Simplified global CSS to work with Tailwind preflight
- Updated PostCSS configuration for Tailwind v4
- Reconciled base styles with Tailwind preflight
- Reorganized and cleaned up duplicate styles in index.css
- Made reading progress indicator smaller and more subtle

### Fixed

- Reading position indicator now always visible at bottom of screen
- Progress tracking now accurately reflects reading position
- Scroll behavior consistent across desktop and mobile
- Removed padding on mobile main pane for edge-to-edge content
- Removed mobile content pane gap for better layout
- Document scroll with important overrides for consistent behavior

## [0.5.7] - 2025-01-14

### Added

- Vimeo video metadata extraction support
- YouTube video metadata extraction with title, description, and captions
- Responsive video player with aspect ratio support
- Thumbnail images in compact view
- URL routing for /me page tabs
- Bookmark navigation in reading list
- Video duration display for video URLs
- Three-dot menu for videos with open/native/copy/share actions
- External video embedding in reader using react-player
- Video detection for Vimeo, Dailymotion, and other platforms

### Changed

- Enhanced borders for reading list cards
- Reading list tab colored blue to match bookmarks icon
- Left-aligned text in reading list elements
- Increased spacing between mobile buttons and profile element
- Main pane now full width when displaying videos
- Video container breaks out of reader padding for full width
- Simplified video container layout

### Fixed

- Video player edge-to-edge display with negative margins
- Prevent profile element from bleeding off screen on mobile
- Resolved TypeScript errors in youtube-meta.ts
- Improved type safety in youtube-meta handler
- More lenient YouTube description extraction
- Corrected setTimeout ref type in Settings
- Proper react-player responsive pattern implementation
- Removed unused getIconForUrlType in CompactView

### Style

- Hide tab counts on mobile for /me page
- Remove max-width on main pane, constrain reader instead
- Full width layout for videos
- Reader-video specific styles

## [0.5.6] - 2025-10-13

### Added

- Three-dot menu for articles and enhanced highlight menus
- Prism.js syntax highlighting for code blocks
- Inline image rendering in nostr-native blog posts
- Image placeholders on blog post cards in `/explore`
- Caching on `/me` page for faster loading

### Changed

- Reading List on `/me` now uses the same components as the bookmarks sidebar
- Improve bookmarks sidebar visual design
- Make article menu button more subtle by removing border

### Fixed

- Use round checkmark icon (faCheckCircle) for Mark as Read button
- Remove extra horizontal divider above article menu
- Ensure code blocks consistently use monospace fonts
- Preserve reading font settings in markdown images

### Style

- Remove horizontal divider above Mark as Read button
- Remove horizontal divider below article menu button

## [0.5.5] - 2025-01-27

### Added

- `/me` page with tabbed layout featuring Highlights, Reading List, and Library tabs
- Two-pane layout for `/me` page with article sources and highlights
- Custom FontAwesome Pro books icon for Archive tab
- CompactButton component for highlight cards
- Instant mark-as-read functionality with checkmark animation and read status checking

### Changed

- Rename Library tab to Archive
- Move highlight timestamp to top-right corner of cards
- Replace username with AuthorCard component on `/me` page
- Use user's custom highlight color for Highlights tab
- Render library articles using BlogPostCard component for consistency
- Use faBooks icon for Mark as Read button
- Make quote icon a CompactButton in top-left corner

### Fixed

- Include currentArticle in useEffect deps to satisfy lint
- Deduplicate article events in library to prevent showing duplicates
- Remove incorrect useSettings hook usage in Me component
- Correct fetchBookmarks usage with callback pattern in Me component
- Add padding to prevent quote text from overlapping timestamp
- Improve spacing and alignment of highlight card elements
- Align corner elements symmetrically with proper margins
- Group relay icon and author in footer-left for consistent alignment
- Position relay indicator in bottom-left corner to prevent overlap with author

### Style

- Match `/me` profile card width to highlight cards
- Improve Me page mobile tabs and avoid overlap with sidebar buttons
- Reduce margins/paddings to make highlight cards more compact
- Tighten vertical spacing on highlight cards
- Left-align text inside author card
- Constrain `/me` page content width to match author card (600px)
- Improve tab border styling for dark theme
- Make relay indicator match CompactButton (same look as menu)
- Align relay indicator within footer with symmetric spacing
- Make header and footer full-width with borders and corners

## [0.5.4] - 2025-10-13

### Changed

- Refactor CSS into modular structure
  - Split 3600+ line monolithic `index.css` into organized modules
  - Created `src/styles/` directory with base, layout, components, and utils subdirectories
  - Each file kept under 210 lines for maintainability
  - Preserved cascade order and selector specificity via ordered `@import` statements
  - No functional changes to styling

### Fixed

- Mobile button positioning now uses safe area insets for symmetrical layout on notched devices

## [0.5.3] - 2025-10-13

### Changed

- Relay status indicator is now more compact
  - Smaller padding and font sizes on desktop
  - Auto-collapsed on mobile (icon-only by default, tap to expand)
  - Matches size of sidebar toggle buttons (44px touch target)
  - Hides when scrolling down, shows when scrolling up (consistent with other mobile controls)

### Fixed

- Invalid bookmarks without IDs no longer appear in bookmark list
  - Previously showed as "Now" timestamp with no content
  - Bookmarks without valid IDs are now filtered out entirely
  - Use bookmark's original timestamp instead of always generating new ones
- Profile icon size when logged out now matches other icon buttons in sidebar header

## [0.5.2] - 2025-10-12

### Added

- Three-dot menu to highlight cards for more compact UI
  - Combines "Open on Nostr" and "Delete" actions into dropdown menu
  - Uses horizontal ellipsis icon (⋯)
  - Click-outside functionality to close menu

### Changed

- Switch Nostr gateway from njump.me/search.dergigi.com to ants.sh
  - Centralized gateway URLs in config file
  - All profile and event links now use ants.sh
  - Automatic detection of identifier type (profile vs event) for proper routing
- Remove loading text from Explore and Me pages (spinner only)
- "Open on Nostr" now links to the highlight event itself instead of the article

### Fixed

- Gateway URL routing for ants.sh requirements (/p/ for profiles, /e/ for events)
- Linting errors in HighlightItem component

## [0.5.1] - 2025-10-12

### Added

- Highlight color customization to UI elements
  - Apply user's "my highlights" color to highlight creation buttons
  - Apply highlight group colors to highlight count indicators
  - Apply "my highlights" color to collapsed highlights panel button

### Fixed

- Highlight count indicator styling to match reading-time element
- Brightness and border styling for highlight count indicator
- User highlight color now applies to both marker and arrow icons
- Highlight group color properly applied to count indicator background

### Removed

- MOBILE_IMPLEMENTATION.md documentation file

## [0.5.0] - 2025-10-12

### Added

- Upgrade to full PWA with `vite-plugin-pwa`
- Replace placeholder icons with branded favicons
- Author info card for nostr-native articles

### Changed

- Explore: shrink refresh spinner footprint; inline-sized loading row
- Explore: preserve posts across navigations; seed from cache; merge streamed and final results
- Explore: keep posts visible during refresh; inline spinner; no list wipe
- Bookmarks: keep list visible during refresh; show spinner only; no wipe
- Bookmarks: avoid clearing list when no new events; decouple refetch from route changes
- Highlights: split service into smaller modules to keep files under 210 lines
- Lint/TypeScript: satisfy react-hooks dependencies; fix worker typings; clear ESLint/TS issues

### Fixed

- Highlights: merge remote results after local for article/url
- Explore: always query remote relays after local; stream merge into UI
- Improve mobile touch targets for highlight icons
- Color `/me` highlights with "my highlights" color setting

### Performance

- Local-first then remote follow-up across services (titles, bookmarks, highlights)
- Run local and remote fetches concurrently; stream and dedupe results
- Stream contacts and early posts from local; merge remote later
- Relay queries use local-first with short timeouts; fallback to remote when needed
- Stream results to UI; display cached/local immediately (articles, highlights, explore)

### Documentation

- PWA implementation summary and launch checklist updates
- Update docs to reflect branded icons and final steps
- Remove temporary PWA launch checklist and implementation summary

## [0.4.3] - 2025-10-11

### Added

- Mark as read functionality for articles (NIP-25)
  - Button at the end of each article to mark as read with 📚 emoji
  - Creates kind:7 reactions for nostr-native articles (`/a/` paths)
  - Creates kind:17 reactions for external websites (`/r/` paths)
  - Button shows loading state while publishing reaction
  - Only visible when user is logged in
- Highlight deletion with confirmation dialog (NIP-09)
  - Small delete button (trash icon) on highlight items
  - Only visible for user's own highlights
  - Confirmation dialog prevents accidental deletions
  - Styled to match relay indicator (subtle, same size)
  - Removes highlights from UI immediately after deletion request
- `/me` page showing user's recent highlights
  - Accessible by clicking profile picture in bookmark sidebar
  - Displays all highlights created by the logged-in user
  - Uses same rendering as Settings and Explore pages
  - Includes highlight count in header
- Confirmation dialog component
  - Reusable modal with danger/warning/info variants
  - Backdrop blur effect
  - Mobile-responsive design
  - Prevents accidental destructive actions

### Changed

- Relay status indicator on mobile now displays in compact mode
  - Shows only airplane icon by default (44x44px touch target)
  - Tap to expand for full connection details
  - Reduces screen clutter on mobile while keeping info accessible
  - Smooth transition between compact and expanded states
  - Desktop view remains unchanged (always shows full details)

## [0.4.2] - 2025-10-11

### Added

- NIP-19 identifier resolution in article content (NIP-19, NIP-27)
  - Support for `nostr:npub1...`, `nostr:note1...`, `nostr:nprofile1...`, `nostr:nevent1...`, `nostr:naddr1...`
  - Converts nostr: URIs to clickable links with human-readable labels
  - Automatically fetches and displays article titles for `naddr` references
  - Falls back to identifier when title fetch fails
- Auto-hide mobile UI buttons on scroll down
  - Floating bookmark/highlights buttons hide when scrolling down
  - Buttons reappear when scrolling up for distraction-free reading
  - Smooth opacity transitions for better UX
- Scroll direction detection hook (`useScrollDirection`)
  - Supports both window and element-based scroll detection
  - Configurable threshold and enable/disable options

### Changed

- Article references (`naddr`) now link internally to `/a/{naddr}` instead of external njump.me
- Sidebar auto-closes on mobile when navigating to content via routes
  - Handles clicking on blog posts in Explore view
  - Complements existing sidebar auto-close for bookmarks
- Markdown processing now async to support article title resolution
- Article title resolution fetches titles in parallel for better performance

### Fixed

- Mobile button scroll detection now correctly monitors main pane element
  - Previously monitored window scroll which didn't work on mobile
  - Content scrolls within `.pane.main` div on mobile devices
- All ESLint warnings and TypeScript type errors resolved
  - Added react-hooks plugin to ESLint configuration
  - Fixed exhaustive-deps warnings in components
  - Added block scoping to switch case statements
  - Corrected type references for nostr-tools decode result

## [0.4.1] - 2025-10-10

### Fixed

- Long article summaries overlapping with hero image content on mobile devices
- Article summary now moves below hero image on mobile when longer than 150 characters
- Article summary line clamp reduced from 3 to 2 lines on mobile for better space utilization

### Changed

- Hero image rendering on mobile now uses zoom-to-fit approach with viewport-based sizing
- Hero image height on mobile set to 50vh (constrained between 280px-400px)
- Improved image cropping with center positioning for better visual presentation
- Optimized reader header overlay padding and title sizing on mobile

## [0.4.0] - 2025-10-10

### Added

- Mobile-responsive design with overlay sidebar drawer
- Media query hooks for responsive behavior (`useIsMobile`, `useIsTablet`, `useIsCoarsePointer`)
- Auto-collapse sidebar setting for mobile devices
- Touch-optimized UI with 44x44px minimum touch targets
- Safe area inset support for notched devices
- Mobile hamburger menu and backdrop
- Focus trap in mobile sidebar with ESC key support
- Body scroll locking when mobile sidebar is open
- Mobile-optimized modals (full-screen sheet style)
- Mobile-optimized toast notifications (bottom position)
- Dynamic viewport height support (100dvh)
- Mobile highlights panel as overlay with toggle button

### Changed

- Sidebar now displays as overlay drawer on mobile (≤768px)
- Highlights panel hidden on mobile for better content focus
- Sidebar auto-closes when selecting content on mobile
- Hover effects disabled on touch devices
- Replace hamburger icon with bookmark icon on mobile

### Fixed

- Ensure bookmarks container fills mobile sidepane properly
- Restore desktop grid layout for highlights panel
- Improve empty state and loading visibility in mobile sidepanes
- Add flex properties to mobile bookmark containers for proper filling
- Force bookmarks pane expanded on mobile and ensure highlights pane sits above content on desktop
- Reduce mobile backdrop opacity and ensure sidepanes appear above it
- Replace any type with proper bookmark interface for linter compliance

## [0.3.8] - 2025-10-10

### Fixed

- Add vercel.json configuration to properly handle SPA routing on Vercel deployments (fixes 404 errors on page refresh)

## [0.3.7] - 2025-10-10

### Fixed

- Logout button functionality - now properly clears active account using clearActive() method

## [0.3.6] - 2025-10-10

### Added

- Compact date format for highlights (now, 5m, 3h, 2d, 1mo, 1y)
- Ultra-compact date format for bookmarks sidebar
- Encode event links as nevent/naddr per NIP-19 for better client compatibility
- Render /explore within ThreePaneLayout to keep side panels visible

### Fixed

- Remove incorrect padding-right from highlights container
- Reduce font size of highlight metadata for cleaner look
- Position highlight FAB button relative to article pane instead of viewport
- Adjust relay indicator position for better visual alignment
- Ensure highlight metadata elements align on single visual line with consistent line-height
- Prevent bookmark icons from being cut off in compact view
- Clean up nested borders in bookmark items and sidebar view mode controls
- Align highlight metadata elements on single line in sidebar
- Change explore header icon from compass to newspaper

### Changed

- Make connecting notification more subtle with muted blue background
- Update Boris pubkey for zap splits to npub19802see0gnk3vjlus0dnmfdagusqrtmsxpl5yfmkwn9uvnfnqylqduhr0x
- Update domain references to read.withboris.com (URLs, SEO metadata, and documentation)

## [0.3.5] - 2025-10-09

### Fixed

- Ensure connecting state shows for minimum 15 seconds to prevent premature offline display
- Add Cloudflare Pages routing config for SPA paths

### Changed

- Extend connecting state duration and remove subtitle text for cleaner UI

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

- Domain configuration for <https://xn--bris-v0b.com/>
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

[Unreleased]: https://github.com/dergigi/boris/compare/v0.6.6...HEAD
[0.6.6]: https://github.com/dergigi/boris/compare/v0.6.5...v0.6.6
[0.6.5]: https://github.com/dergigi/boris/compare/v0.6.4...v0.6.5
[0.6.4]: https://github.com/dergigi/boris/compare/v0.6.3...v0.6.4
[0.6.3]: https://github.com/dergigi/boris/compare/v0.6.2...v0.6.3
[0.6.2]: https://github.com/dergigi/boris/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/dergigi/boris/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/dergigi/boris/compare/v0.5.7...v0.6.0
[0.5.7]: https://github.com/dergigi/boris/compare/v0.5.6...v0.5.7
[0.5.6]: https://github.com/dergigi/boris/compare/v0.5.5...v0.5.6
[0.5.5]: https://github.com/dergigi/boris/compare/v0.5.4...v0.5.5
[0.5.2]: https://github.com/dergigi/boris/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/dergigi/boris/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/dergigi/boris/compare/v0.4.3...v0.5.0
[0.4.0]: https://github.com/dergigi/boris/compare/v0.3.8...v0.4.0
[0.3.8]: https://github.com/dergigi/boris/compare/v0.3.7...v0.3.8
[0.3.7]: https://github.com/dergigi/boris/compare/v0.3.6...v0.3.7
[0.3.6]: https://github.com/dergigi/boris/compare/v0.3.5...v0.3.6
[0.3.5]: https://github.com/dergigi/boris/compare/v0.3.4...v0.3.5
[0.3.4]: https://github.com/dergigi/boris/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/dergigi/boris/compare/v0.3.2...v0.3.3
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
