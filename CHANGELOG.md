# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.10.32] - 2025-11-02

### Added

- Loading states with shimmer effect for profile lookups in articles
- localStorage caching for profile resolution with LRU eviction
- Progressive profile resolution that updates from fallback to resolved names

### Changed

- Standardized applesauce helpers for npub/nprofile detection and display
- Standardized profile display name fallbacks across codebase
- Removed 'npub1' prefix from shortened npub displays
- Improved @ prefix handling for profile mentions
- Profile fetching is now reactive (removed timeouts)
- Profile label updates are batched to prevent UI flickering

### Fixed

- Profile label updates now work correctly and preserve pending updates
- Race condition in profile label updates resolved
- React hooks exhaustive-deps warnings resolved
- Rules of Hooks violation in profile mapping
- Syntax error in RichContent try-catch structure
- Profile fetching re-checks eventStore for async profile arrivals
- LRU cache eviction handles QuotaExceededError
- Reduced markdown reprocessing to prevent flicker
- TypeScript errors in nostrUriResolver resolved
- Profile labels initialize synchronously from cache for instant display

### Performance

- Added timing metrics for profile resolution performance
- Increased remote relay timeout for profile fetches
- Batch profile label updates to prevent UI flickering
- Ensure purplepag.es relay is used for profile lookups

### Refactored

- Replaced custom NIP-19 parsing with applesauce helpers
- Standardized profile name extraction and code quality
- Standardized npub/nprofile display implementation
- Use pubkey (hex) as Map key instead of encoded nprofile/npub strings
- Standardized profile display name fallbacks

## [0.10.31] - 2025-11-02

### Changed

- Moved add bookmark button to filter bar and aligned with filter buttons

## [0.10.30] - 2025-11-01

### Added

- Navigate to author's writings page from article author card

### Fixed

- Reset scroll to top when navigating to profile pages
- Preserve image aspect ratio when full-width images setting is enabled

## [0.10.29] - 2025-11-01

### Fixed

- Full-width images setting uses width instead of max-width

## [0.10.28] - 2025-11-01

### Fixed

- Nostr URI processing in markdown links

### Removed

- Debug console.log statements from nostrUriResolver

## [0.10.27] - 2025-10-31

### Added

- Refresh button to highlights sidebar header
- Image preloading for blog posts and user profiles (offline caching)
- Development Service Worker for testing image caching

### Fixed

- Service Worker registration and error handling
- Article loading race conditions
- Scroll position management
- React hook ordering issues
- TypeScript and linting issues

## [0.10.26] - 2025-10-31

### Added

- Persist highlight metadata and offline events to localStorage
- Proper relay response tracking for flight mode

### Changed

- Improved flight mode detection and tracking for highlights
- Refactored to use isLocalOnly flag instead of isOfflineCreated

### Fixed

- Flight mode highlights now properly show airplane icon and track status
- Preserve highlight metadata across event conversions and EventStore
- Prevent duplicate highlights
- Publish only to connected relays to avoid timeouts
- Prevent unnecessary relay queries when content is cached
- Various TypeScript, linting, and React hook dependency issues

## [0.10.25] - 2025-01-27

### Added

- Reading progress bar for all bookmark types across all view modes
- Title display for regular bookmarks/links

### Changed

- Redesigned medium-sized bookmark cards with left-side thumbnails
- Made bookmark cards significantly more compact
- Moved bookmark type icon to bottom right footer
- Enhanced card layout with author positioning in bottom-left corner

### Fixed

- Reading progress bar display and consistency across view modes
- Timestamp and icon alignment issues
- TypeScript and linting errors

### Removed

- Type icon from medium-sized bookmark cards
- Text expansion mechanic from medium-sized cards
- URL display from medium-sized bookmark cards

## [0.10.24] - 2025-01-27

### Added

- Dynamic browser title based on content
- Enhanced web bookmarks with OpenGraph data (using fetch-opengraph library)

### Fixed

- Description extraction from web bookmark content field
- Linting and TypeScript issues

## [0.10.23] - 2025-01-27

### Added

- Video thumbnail support for cover images
- Note content support for direct video URLs
- Smart highlight clearing for articles
- Robust highlight loading with fallback mechanisms

### Changed

- Home button alignment moved to left next to profile button
- Video functionality extracted into dedicated VideoView component

### Fixed

- Article loading performance and error handling
- Highlight loading for articles
- Skeleton loader display
- Video metadata extraction

## [0.10.22] - 2025-01-27

### Added

- Mobile-optimized tab interface for `/my` and `/p/` pages

### Changed

- Updated brand tagline from "Nostr Bookmarks" to "Read, Highlight, Explore"
- Reordered bookmarks bar navigation buttons
- Moved highlight button higher up on screen

### Fixed

- Mobile sidebar not closing when navigating to profile sections
- Removed unnecessary versioning from reading progress implementation

## [0.10.21] - 2025-10-23

### Fixed

- Reading position tracking for internal event URLs
- Compact bookmark view display
- Bookmark deduplication in profile view

## [0.10.20] - 2025-10-23

### Added

- Web Bookmarks section appears first when bookmarks are grouped by source

### Fixed

- Mobile scroll position preservation when toggling highlights panel
- Infinite loop in reading position tracking
- Skeleton loading state for articles with zero highlights
- Navigation to bookmarked articles

## [0.10.19] - 2025-10-23

### Added

- Profile dropdown menu in sidebar header

### Changed

- Profile picture interaction updated
- Collapse buttons repositioned for symmetry
- Grouping toggle button repositioned
- Collapse button styling standardized

### Removed

- Redundant logout button from sidebar header
- Refresh buttons from sidebars

### Fixed

- Cleaned up unused component props and parameters

## [0.10.18] - 2025-10-23

### Changed

- User profile routes renamed from `/me` to `/my`

### Fixed

- `/my/writings` displays all user writings
- `/my/highlights` displays all user highlights

### Refactored

- Centralized data fetching in controllers

## [0.10.17] - 2025-10-23

### Added

- Setting to control auto-scroll to reading position

### Fixed

- Blockquote styling on mobile devices
- Timestamp clicks in highlight cards navigate within app
- Hero images properly extend edge-to-edge on mobile
- Article relay links open via `/a/` path instead of `/r/`

### Changed

- Mobile reader padding increased for better readability
- Reading position save interval reduced from 3s to 1s

## [0.10.16] - 2025-10-22

### Fixed

- Reading position auto-save works correctly during continuous scrolling
- Reading position tracking stability improved

### Changed

- Reading position save mechanism changed from debounce to throttle
- Simplified reading position logic by removing unused complexity

### Fixed

- Highlights scroll into view when clicked from `/my/highlights` page

## [0.10.15] - 2025-01-22

### Changed

- Reading position restore uses pre-loaded data from controller
- Reading position scroll animation restored to smooth behavior

### Fixed

- Reading position no longer saves 0% during back navigation on mobile

## [0.10.14] - 2025-01-27

### Added

- Third relay education article link in PWA settings

### Changed

- Timestamp links in bookmark cards navigate within app
- Relay article links punctuation improved for better readability

### Fixed

- Duplicate video embeds and stray HTML artifacts eliminated
- Highlights loading spinner no longer spins forever when article has zero highlights

## [0.10.13] - 2025-01-27

### Added

- Instant article preview when navigating from blog post cards
- Reliable relay fallback for article fetching

### Changed

- Article loading follows local-first controller pattern
- Service Worker only registers in production builds
- Article fetching queries union of naddr relay hints and configured relays

### Fixed

- Article loading race conditions eliminated
- Content/title mismatch when switching articles resolved
- Article re-fetching on settings changes prevented
- Explore writings tab shows skeletons instead of spinner when loading

## [0.10.12] - 2025-01-27

### Added

- Person hiking icon (fa-person-hiking) for explore navigation

### Changed

- Explore icon changed from newspaper to person hiking for better semantic meaning
- Settings button moved before explore button in sidebar navigation
- Profile avatar button uses 44px touch target on mobile

### Fixed

- Web bookmarks (kind:39701) properly deduplicate by d-tag
- Same URL bookmarked multiple times only appears once
- Web bookmark IDs use coordinate format (kind
- Profile avatar button sizing on mobile matches other IconButton components
- Removed all console.log statements from bookmarkController and bookmarkProcessing

## [0.10.11] - 2025-01-27

### Added

- Clock icon for chronological bookmark view
- Clickable highlight count to open highlights sidebar
- Dynamic bookmark filter titles based on selected filter
- Profile picture moved to first position (left-aligned) with consistent sizing

### Changed

- Default bookmark view changed to flat chronological list
- Bookmark URL changed from `/my/reading-list` to `/my/bookmarks`
- Router updated to handle `/my/reading-list` → `/my/bookmarks` redirect
- Me.tsx bookmarks tab uses dynamic filter titles and chronological sorting
- Me.tsx updated to use faClock icon instead of faBars
- Removed bookmark count from section headings for cleaner display
- Hide close/collapse sidebar buttons on mobile for better UX

### Fixed

- Bookmark sorting now uses proper timestamps (created_at || listUpdatedAt, nulls last)
- Bookmark timestamps display correctly with fallbacks
- Chronological sorting consistency

### Refactored

- Removed excessive debug logging for cleaner console output
- Bookmark timestamp handling never defaults to "now", allows nulls and sorts nulls last
- Renders empty when timestamp is missing instead of showing invalid dates

## [0.10.10] - 2025-10-22

### Changed

- Version bump for consistency

## [0.10.9] - 2025-10-21

### Fixed

- Event fetching reliability with exponential backoff in eventManager
- Bookmark timestamp handling

### Changed

- Removed all debug console logs

## [0.10.8] - 2025-10-21

### Added

- Individual event rendering via `/e/:eventId` path
- Centralized event fetching via new `eventManager` singleton

### Fixed

- Bookmark hydration efficiency
- Search button behavior for notes
- Author profile resolution

## [0.10.7] - 2025-10-21

### Fixed

- Profile pages display all writings correctly

### Changed

- Simplified profile background fetching logic for better maintainability

## [0.10.6] - 2025-10-21

### Added

- Text-to-speech reliability improvements

### Fixed

- Tab switching regression on `/my` page
- Explore page data loading patterns
- Text-to-speech handler cleanup

## [0.10.4] - 2025-10-21

### Added

- Web Share Target support for PWA

### Changed

- Manifest includes `share_target` configuration for system share menu integration
- Service worker handles POST requests to `/share-target` endpoint
- Added `/share-target` route for processing incoming shared content

## [0.10.3] - 2025-10-21

### Added

- Content filtering setting to hide articles posted by bots

### Fixed

- Resolved all linting and type checking issues

## [0.10.2] - 2025-10-20

### Added

- Text-to-speech (TTS) speaker language selection mode
- TTS example text section in settings

### Changed

- TTS language selection uses "Speaker language" terminology

### Fixed

- TTS voice detection and selection logic

## [0.10.0] - 2025-01-27

### Added

- Centralized bookmark loading with streaming and auto-decrypt
- Enhanced debug page with comprehensive diagnostics
- Bunker (NIP-46) authentication support

### Changed

- Improved bookmark loading performance
- Enhanced bunker error messages
- Centralized bookmark loading architecture

### Fixed

- NIP-46 bunker signing and decryption
- Bookmark loading and decryption
- TypeScript and linting errors throughout

### Performance

- Non-blocking NIP-46 operations
- Optimized bookmark loading

### Refactored

- Centralized bookmark controller architecture
- Debug page organization
- Simplified bunker implementation following applesauce patterns

### Documentation

- Comprehensive Amber.md documentation

## [0.9.1] - 2025-10-20

### Added

- Video embedding for nostr-native content
- Media display settings
- Article view improvements

### Changed

- Enable media display options by default for a better out‑of‑the‑box experience
- Constrain video player to reader width to prevent horizontal overflow

### Fixed

- Prevent double video player rendering when both processor and panel attempted to embed
- Remove text artifacts and broken tags when converting markdown image/video URLs
- Resolved remaining ESLint and TypeScript issues

### Performance

- Optimized Support page loading with instant display and skeletons

## [0.9.0] - 2025-01-20

### Added

- User relay list integration
- Relay list debug section in Debug component

### Changed

- Improved relay list loading performance
- Enhanced relay URL handling

### Fixed

- Resolved all linting issues across the codebase
- Fixed TypeScript type issues in relayListService
- Cleaned up temporary test relays from hardcoded list
- Removed non-relay console.log statements and debug output

### Technical

- Enhanced relay initialization logging for better diagnostics
- Improved error handling and timeout management for relay queries
- Better separation of concerns between relay loading and application startup

## [0.8.6] - 2025-10-20

### Fixed

- React Hooks violations in NostrMentionLink component

## [0.8.4] - 2024-10-20

### Added

- Progressive article hydration for reads tab

### Fixed

- Fixed React type imports in useArticleLoader

## [0.8.3] - 2025-01-19

### Fixed

- Highlight creation shows immediate UI feedback without page refresh

### Changed

- Improved highlight creation user experience

## [0.8.2] - 2025-10-19

### Added

- Reading progress indicator in compact bookmark cards

### Changed

- Compact cards layout optimizations for more space-efficient display
- Reading progress bar styling for compact view

### Fixed

- Removed borders from compact bookmarks in bookmarks sidebar

## [0.8.0] - 2025-10-19

### Added

- Centralized reading progress controller for non-blocking reading position sync
- Reading progress indicators on blog post cards

### Changed

- Reading position sync enabled by default in runtime paths
- Improved auto-mark-as-read behavior with reliable completion detection
- Reading progress events use proper NIP-85 specification

### Fixed

- Reading position saves with proper validation and event store integration
- Profile page writings loading fetches all writings without limits
- Consistent reading progress calculation and event publishing

### Performance

- Non-blocking reading progress controller with streaming updates
- Cache-first loading strategy with local event store before relay queries
- Efficient progress merging and deduplication

## [0.7.4] - 2025-10-18

### Added

- Profile page data preloading for instant tab switching

### Changed

- `/my/bookmarks` tab displays in cards view only
- Highlights sidebar filters simplified when logged out

### Fixed

- Profile page tabs display cached content instantly

### Performance

- Cache-first profile loading strategy

## [0.7.3] - 2025-10-18

### Added

- Centralized nostrverse writings controller for kind 30023 content
- Centralized nostrverse highlights controller
- Writings loading debug section on `/debug` page

### Changed

- Explore page uses centralized `writingsController` for user's own writings
- Explore page loading strategy optimized
- User's own writings included in Explore when enabled

### Fixed

- Explore page works correctly in logged-out mode
- Explore page no longer allows disabling all scope filters
- Explore page reflects default scope setting immediately
- Explore page highlights properly scoped
- Article-specific highlights properly filtered
- Explore writings properly deduplicated
- Debug page writings loading section added

### Performance

- Non-blocking explore page loading
- Lazy-loading for content filters
- Streaming callbacks for progressive updates

## [0.7.2] - 2025-01-27

### Added

- Cached-first loading with EventStore across the app
- Default explore scope setting for controlling content visibility

### Changed

- Highlights and writings load from cache first, then stream from relays
- Explore page shows cached content instantly before network updates
- Article-specific highlights stored in centralized event store for faster access
- Nostrverse content cached locally for improved performance

### Fixed

- Prevent "No highlights yet" flash on `/my/highlights` page
- Force React to remount tab content when switching tabs for proper state management
- Deduplicate blog posts by author:d-tag instead of event ID for better accuracy
- Show skeleton placeholders while highlights are loading for better UX

### Performance

- Local-first loading strategy reduces perceived loading times
- Cached content displays immediately while background sync occurs
- Centralized event storage eliminates redundant network requests

## [0.7.0] - 2025-10-18

### Added

- Login with Bunker (NIP-46) authentication support
- Debug page (`/debug`) for diagnostics and testing
- Progressive bookmark loading with streaming updates
- Bookmark grouping toggle

### Changed

- Improved login UI with better copy and modern design
- Enhanced bunker error messages
- Centralized bookmark loading architecture
- Renamed UI elements for clarity
- Settings version footer improvements

### Fixed

- NIP-46 bunker signing and decryption
- Bookmark loading and decryption
- PWA cache limit increased to 3 MiB for larger bundles
- Extension login error messages with nos2x link
- TypeScript and linting errors throughout

### Performance

- Non-blocking NIP-46 operations
- Optimized bookmark loading

### Refactored

- Centralized bookmark controller architecture
- Debug page organization
- Simplified bunker implementation following applesauce patterns

### Documentation

- Comprehensive Amber.md documentation

## [0.6.24] - 2025-01-16

### Fixed

- TypeScript global declarations for build-time defines

## [0.6.23] - 2025-01-16

### Fixed

- Deep-link refresh redirect issue for nostr-native articles

### Added

- Version and git commit information in Settings footer

### Changed

- Article OG handler uses proper RelayPool.request() API

### Technical

- Added debug logging for route state and article OG handler

## [0.6.22] - 2025-10-16

### Added

- Dynamic OpenGraph and Twitter Card meta tags for article deep-links
- Social preview image for homepage and article links

### Changed

- Article deep-links properly preserve URL when loading in browser

### Fixed

- Vercel rewrite configuration for article routes

## [0.6.21] - 2025-10-16

### Added

- Reading position sync across devices using Nostr Kind 30078
- Reading progress filters for organizing articles
- Reads and Links tabs on `/my` page
- Auto-mark as read at 100% reading progress
- Click-to-open article navigation on highlights

### Changed

- Renamed Archive to Reads with expanded functionality
- Merged 'Completed' and 'Marked as Read' filters into one unified filter
- Simplified filter icon colors to blue
- Started reading progress state (0-10%) uses neutral text color
- Replace spinners with skeleton placeholders during refresh in Archive/Reads/Links tabs
- Removed unused IEventStore import in ContentPanel

### Fixed

- Reading position calculation accurately reaches 100%
- Reading position filters work correctly in bookmarks sidebar
- Filter out reads without timestamps or 'Untitled' items
- Show skeleton placeholders correctly during initial tab load
- External URLs in Reads tab only shown if they have reading progress
- Reading progress merges even when timestamp is older than bookmark
- Resolved all linter errors and TypeScript type issues

### Refactored

- Renamed ArchiveFilters component to ReadingProgressFilters
- Extracted shared utilities from readsFromBookmarks for DRY code
- Use setState callback pattern for background enrichment
- Use naddr format for article IDs to match reading positions
- Extract article titles, images, summaries from bookmark tags using applesauce helpers

## [0.6.20] - 2025-10-15

### Added

- Bookmark filter buttons by content type
- Private Bookmarks section for encrypted legacy bookmarks

### Changed

- Bookmark section labels improved for clarity
- Bookmark filter button styling refined
- Lock icon removed from individual bookmarks
- External article icon changed to link icon

### Fixed

- Highlight button positioning and visibility

## [0.6.19] - 2025-10-15

### Fixed

- Highlights disappearing on external URLs after a few seconds

## [0.6.18] - 2025-10-15

### Changed

- Zap split labels simplified and terminology updated
- Zap preset buttons on desktop expand to match slider width
- PWA install section always visible in settings

### Fixed

- PWA install button properly disabled when installation is not possible on device
- App & Airplane Mode section always visible regardless of PWA status

## [0.6.17] - 2025-10-15

### Added

- PWA settings illustration (`pwa.svg`) displayed on right side of section
- Zaps illustration (`zaps.svg`) displayed on right side of Zap Splits section
- Visual 50% indicators on zap split sliders
- Lightning bolt icons as slider thumbs for zap splits
- Offline-first description paragraph at beginning of App & Airplane Mode section
- Settings page width constraint

### Changed

- Settings section reorganization
- PWA settings section restructure
- Zap split sliders styling
- Zap split description text styling
- Clear cache button styling
- Font Size buttons alignment
- Default Highlight Visibility position
- Spacing adjustments in App & Airplane Mode section

### Fixed

- PWA settings paragraph wrapping
- Font Size buttons alignment issues
- Slider thumb icon centering

## [0.6.16] - 2025-10-15

### Changed

- Replaced delete dialog popup with inline confirmation UI
- Reordered Reading & Display settings for better organization
- Setting buttons align vertically with fixed label width

### Fixed

- Removed unused `handleCancelDelete` function after dialog removal

## [0.6.15] - 2025-10-15

### Added

- Paragraph alignment setting with left-aligned and justified text options

### Changed

- Default paragraph alignment changed to justified for improved reading experience

## [0.6.14] - 2025-10-15

### Added

- Support for bookmark sets
- Content type icons for bookmarks
- Bookmark grouping and sections
- Adaptive text color for publication date over hero images

### Changed

- Renamed "Amethyst-style bookmarks" to "Old Bookmarks (Legacy)"
- Hide cover images in compact view for cleaner layout
- Support button improvements
- Section headings improved with better typography
- Icon changed from book to file-lines for default bookmarks
- Use regular (outlined) icon variants for lighter, more refined appearance
- Add bookmark button moved to web bookmarks section
- Empty state messages replaced with loading spinners
- Section dividers made more subtle
- Simplified bookmark filtering to only exclude empty content

### Fixed

- Removed borders from compact bookmark cards for cleaner look
- Removed duplicate type indicator icons from bookmark cards
- Reduced section heading bottom padding for better spacing
- Aligned add bookmark button with section heading
- Removed redundant loading spinner above tabs
- Resolved linter and type errors
- Include kind:30003 in default bookmark list detection
- Removed text shadows from publication date for cleaner look
- Improved shadow contrast without background overlay
- Corrected async handling in adaptive color detection
- Corrected FastAverageColor import to use named export
- Section heading styles properly override with `!important`
- Removed unused articleImage prop from CompactView

## [0.6.13] - 2025-10-15

### Added

- Support for `nprofile` identifiers on `/p/` profile pages
- Gradient placeholder images for articles without cover images

### Changed

- PWA install section styling in settings

### Fixed

- Mobile bookmark button visibility across all pages
- Mobile highlights button behavior at page top

## [0.6.12] - 2025-10-15

### Changed

- Horizontal dividers (`<hr>`) in blog posts display with more subtle styling

## [0.6.11] - 2025-10-15

### Added

- Colored borders to blog post and highlight cards based on relationship
- Mobile sidebar toggle buttons on explore page

### Fixed

- Mobile bookmarks sidebar opening and closing immediately

## [0.6.10] - 2025-10-15

### Added

- Support page (`/support`) displaying zappers with avatar grid
- Refresh button to explore page
- Unified event publishing and querying services
- FEATURES.md documentation file
- MIT License

### Changed

- Explore page improvements
- Pull-to-refresh library
- Loading states show progressive loading with skeletons instead of blocking error screens
- All event fetching services migrated to unified `queryEvents` helper
- Contact streaming with extended timeout and partial results

### Fixed

- All ESLint and TypeScript linting errors
- Explore page refresh loop and false empty-follows error
- Zap receipt scanning with applesauce helpers and more relays
- Support page theme colors for proper readability

### Refactored

- Event publishing to use unified `publishEvent` service
- Event fetching to use unified `queryEvents` helper
- Image cache and bookmark components
- Support page spacing and visual hierarchy

## [0.6.9] - 2025-10-14

### Documentation

- Minor changelog formatting updates

## [0.6.8] - 2025-10-14

### Changed

- Updated favicon and app icons to purple theme

## [0.6.7] - 2025-10-14

### Added

- Skeleton loading placeholders using `react-loading-skeleton` package
- Nostr identifier parsing and rendering in highlight comments
- Visibility filters for explore page content

### Changed

- Loading states use skeleton placeholders instead of spinners for more polished UX
- Removed incremental loading spinner from explore page refresh

### Fixed

- Type error in `HighlightItem.tsx` using `React.ReactElement` instead of `JSX.Element`
- Me page skeleton loading handles undefined `viewingPubkey` gracefully

### Documentation

- Updated FontAwesome rule to prefer skeleton placeholders over loading text or spinners

## [0.6.6] - 2025-10-14

### Added

- Profile fetching and caching for explore page
- Rich content rendering in highlight comments

### Changed

- Hide citation in highlights sidebar when viewing article

### Fixed

- Blog posts with far-future publication dates no longer appear in explore
- Layout breaks from long URLs in highlight comments
- Profile fetching implementation

## [0.6.5] - 2025-10-14

### Added

- Highlights tab on `/explore` page
- Citation attribution on highlight items
- Comment icon (fa-comments) for highlights with comments
- Click timestamp to open highlight in native Nostr app

### Changed

- Highlight counter text color matches article text
- Highlight level colors applied to explore page highlights
- Explore page tab order: Highlights first, Writings second
- Explore page tabs extend full width to match content grid

### Fixed

- Highlight counter readability in light mode
- Scroll-to-highlight reliability in article view
- Author attribution in highlight citations
- Explore page grid layout

### Style

- Replaced server icon with highlighter icon in highlight items
- Switch from solid comment icon to outlined comments icon
- Removed background from highlight comments for cleaner appearance
- Removed extra left margin from comments
- Comment icon colored by highlight level with no opacity

### Dependencies

- Added @fortawesome/free-regular-svg-icons package for outlined icons

## [0.6.4] - 2025-10-14

### Added

- Color theme variants for light and dark modes
- Playful empty state message for other users' profiles
- Profile links open within app instead of external portals

### Changed

- Default light theme changed to sepia for better readability
- Theme setting labels renamed from 'Colors' to 'Theme'
- Highlight text aligns properly with footer icons
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
- Reading progress indicator uses theme colors
- Highlights tab readability improved in light mode with proper background
- Empty state text color changed from red to gray for better aesthetics
- Replaced 'any' types with proper type definitions for better type safety

### Refactored

- Migrated entire codebase to semantic token system
- Removed localStorage for theme persistence, using only Nostr
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
- Three-dot menu for external URLs in reader

### Changed

- Bookmark refresh button moved to footer alongside view mode controls
- Unified button styles across left and right sidebars

### Fixed

- Reader content alignment on desktop
- Highlight text matching with multiple improvements

## [0.6.1] - 2025-10-13

### Added

- Writings tab on `/my` page to display user's published articles
- Comprehensive headline styling (h1-h6) with Tailwind typography
- List styling for ordered and unordered lists in articles
- Blockquote styling with indentation and italics
- Vertical padding to blockquotes for better readability
- Horizontal padding for reader text content on desktop
- Drop-shadows to sidebars for visual depth
- MutationObserver for tracking highlight DOM changes

### Changed

- Article titles larger and more prominent
- Article summaries display properly in reader header
- Zap splits settings UI with preset buttons and full-width sliders
- Sidebars extend to 100vh height
- Blockquote styling simplified to minimal indent and italic
- Improved zap splits settings visual design

### Fixed

- Horizontal overflow from code blocks and wide content on mobile
- Settings view mobile-friendly with proper width constraints
- Long relay URLs no longer cause horizontal overflow on mobile
- Sidebar/highlights toggle buttons hidden on settings/explore/my pages
- Video titles show filename instead of 'Error Loading Content'
- AddBookmarkModal z-index issue fixed using React Portal
- Highlight matching for text spanning multiple DOM nodes/inline elements
- Highlights appear as single continuous element across DOM nodes
- Highlights display immediately after creation with synchronous render
- Scroll-to-highlight functionality restored after DOM updates
- Padding gaps around sidebars removed
- TypeScript errors in video-meta.ts resolved

### Refactored

- Migrated entire color system to Tailwind v4 color palette
- Migrated all CSS files (sidebar, highlights, cards, forms, reader, etc.) to Tailwind colors
- Updated default highlight colors to yellow-400 for markers and yellow-300 for other contexts
- Added comprehensive color system documentation
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

- Reading position indicator always visible at bottom of screen
- Progress tracking accurately reflects reading position
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
- URL routing for /my page tabs
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
- Main pane full width when displaying videos
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

- Hide tab counts on mobile for /my page
- Remove max-width on main pane, constrain reader instead
- Full width layout for videos
- Reader-video specific styles

## [0.5.6] - 2025-10-13

### Added

- Three-dot menu for articles and enhanced highlight menus
- Prism.js syntax highlighting for code blocks
- Inline image rendering in nostr-native blog posts
- Image placeholders on blog post cards in `/explore`
- Caching on `/my` page for faster loading

### Changed

- Reading List on `/my` uses the same components as the bookmarks sidebar
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

- `/my` page with tabbed layout featuring Highlights, Reading List, and Library tabs
- Two-pane layout for `/my` page with article sources and highlights
- Custom FontAwesome Pro books icon for Archive tab
- CompactButton component for highlight cards
- Instant mark-as-read functionality with checkmark animation and read status checking

### Changed

- Rename Library tab to Archive
- Move highlight timestamp to top-right corner of cards
- Replace username with AuthorCard component on `/my` page
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

- Match `/my` profile card width to highlight cards
- Improve My page mobile tabs and avoid overlap with sidebar buttons
- Reduce margins/paddings to make highlight cards more compact
- Tighten vertical spacing on highlight cards
- Left-align text inside author card
- Constrain `/my` page content width to match author card
- Improve tab border styling for dark theme
- Make relay indicator match CompactButton
- Align relay indicator within footer with symmetric spacing
- Make header and footer full-width with borders and corners

## [0.5.4] - 2025-10-13

### Changed

- Refactor CSS into modular structure

### Fixed

- Mobile button positioning uses safe area insets for symmetrical layout on notched devices

## [0.5.3] - 2025-10-13

### Changed

- Relay status indicator is more compact

### Fixed

- Invalid bookmarks without IDs no longer appear in bookmark list
- Profile icon size when logged out matches other icon buttons in sidebar header

## [0.5.2] - 2025-10-12

### Added

- Three-dot menu to highlight cards for more compact UI

### Changed

- Switch Nostr gateway from njump.me/search.dergigi.com to ants.sh
- Remove loading text from Explore and Me pages
- "Open on Nostr" links to the highlight event itself instead of the article

### Fixed

- Gateway URL routing for ants.sh requirements
- Linting errors in HighlightItem component

## [0.5.1] - 2025-10-12

### Added

- Highlight color customization to UI elements

### Fixed

- Highlight count indicator styling to match reading-time element
- Brightness and border styling for highlight count indicator
- User highlight color applies to both marker and arrow icons
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
- Color `/my` highlights with "my highlights" color setting

### Performance

- Local-first then remote follow-up across services
- Run local and remote fetches concurrently; stream and dedupe results
- Stream contacts and early posts from local; merge remote later
- Relay queries use local-first with short timeouts; fallback to remote when needed
- Stream results to UI; display cached/local immediately

### Documentation

- PWA implementation summary and launch checklist updates
- Update docs to reflect branded icons and final steps
- Remove temporary PWA launch checklist and implementation summary

## [0.4.3] - 2025-10-11

### Added

- Mark as read functionality for articles
- Highlight deletion with confirmation dialog
- `/my` page showing user's recent highlights
- Confirmation dialog component

### Changed

- Relay status indicator on mobile displays in compact mode

## [0.4.2] - 2025-10-11

### Added

- NIP-19 identifier resolution in article content
- Auto-hide mobile UI buttons on scroll down
- Scroll direction detection hook

### Changed

- Article references (`naddr`) link internally to `/a/{naddr}` instead of external njump.me
- Sidebar auto-closes on mobile when navigating to content via routes
- Markdown processing async to support article title resolution
- Article title resolution fetches titles in parallel for better performance

### Fixed

- Mobile button scroll detection correctly monitors main pane element
- All ESLint warnings and TypeScript type errors resolved

## [0.4.1] - 2025-10-10

### Fixed

- Long article summaries overlapping with hero image content on mobile devices
- Article summary moves below hero image on mobile when longer than 150 characters
- Article summary line clamp reduced from 3 to 2 lines on mobile for better space utilization

### Changed

- Hero image rendering on mobile uses zoom-to-fit approach with viewport-based sizing
- Hero image height on mobile set to 50vh
- Improved image cropping with center positioning for better visual presentation
- Optimized reader header overlay padding and title sizing on mobile

## [0.4.0] - 2025-10-10

### Added

- Mobile-responsive design with overlay sidebar drawer
- Media query hooks for responsive behavior
- Auto-collapse sidebar setting for mobile devices
- Touch-optimized UI with 44x44px minimum touch targets
- Safe area inset support for notched devices
- Mobile hamburger menu and backdrop
- Focus trap in mobile sidebar with ESC key support
- Body scroll locking when mobile sidebar is open
- Mobile-optimized modals
- Mobile-optimized toast notifications
- Dynamic viewport height support
- Mobile highlights panel as overlay with toggle button

### Changed

- Sidebar displays as overlay drawer on mobile
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

- Add vercel.json configuration to properly handle SPA routing on Vercel deployments

## [0.3.7] - 2025-10-10

### Fixed

- Logout button functionality

## [0.3.6] - 2025-10-10

### Added

- Compact date format for highlights
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
- Update domain references to read.withboris.com

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
- "Connecting" status indicator on page load
- Last fetch time display with relative timestamps in bookmarks list

### Changed

- Simplify image caching to use Service Worker transparently
- Move refresh button from top bar to end of bookmarks list
- Make explore page article cards proper links
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
- Automatic offline sync
- Relay indicator icon on highlight items showing sync status
- Click-to-rebroadcast functionality for highlights
- Flight mode indicator (plane icon) on offline-created highlights
- Relay rebroadcast settings for caching and propagation
- Local relay status indicator for local-only/offline mode
- Second local relay support
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

- Web bookmark creation
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

- Cleanup after build fixes
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

- Support for web bookmarks
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
- Add context to highlights
- Boris branding to highlight alt tag

### Fixed

- Properly await account loading from localStorage on refresh
- Add protected routes to prevent logout on page refresh
- Use undo icon for reset to defaults button
- Update local relay port to 10547

### Changed

- Remove dedicated login page, handle login through main UI
- Simplify to single RELAYS constant

## [0.2.0] - 2025-10-05

### Added

- Simple highlight creation feature
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
- Correct default highlight color for 'mine' to yellow

### Changed

- Reduce padding between bookmark items and panel edge
- Update default highlight colors to orange for friends and purple for nostrverse

## [0.1.10] - 2025-10-05

### Added

- Three-level highlight system

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
- Refresh button works without login for article highlights
- Query highlights using both a-tag and e-tag

### Changed

- Keep Bookmarks.tsx under 210 lines by extracting logic

## [0.1.6] - 2025-10-03

### Added

- Native support for rendering Nostr long-form articles
- Display article titles for kind:30023 bookmarks
- Enable clicking on kind:30023 articles to open in reader
- Display article hero images in bookmark views and reader
- Configurable highlight colors
- Highlight style setting

### Fixed

- Use bookmark pubkey for article author instead of tag lookup
- Ensure highlight color CSS variable inherits from parent

### Changed

- Integrate long-form article rendering into existing reader view
- Extract components to keep files under 210 lines
- Make font size and color buttons match icon button size

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
- Sort bookmarks by added_at
- Make kind icon square to match IconButton sizing
- Remove colored borders and gradients; keep neutral cards

## [0.1.0] - 2025-10-03

### Added

- Two-pane layout and content fetching pipeline
- ContentPanel component to render readable HTML
- Lightweight readability fetcher via r.jina.ai proxy
- Markdown rendering support with react-markdown and remark-gfm
- READ button to bookmark cards
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

- Sort individual bookmarks by timestamp
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
- Aggregate list
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