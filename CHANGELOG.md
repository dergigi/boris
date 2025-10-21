# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.10.8] - 2025-10-21

### Added

- Individual event rendering via `/e/:eventId` path
  - Display `kind:1` notes and other events with article-like presentation
  - Publication date displayed in top-right corner like articles
  - Author attribution with "Note by @author" titles
  - Direct event loading with intelligent caching from eventStore
- Centralized event fetching via new `eventManager` singleton
  - Request deduplication for concurrent fetches
  - Automatic retry logic when relay pool becomes available
  - Non-blocking background fetching with 12-second timeout
  - Seamless integration with eventStore for instant cached event display

### Fixed

- Bookmark hydration efficiency
  - Only request content for bookmarks missing data (not all bookmarks)
  - Use eventStore fallback for instant display of cached profiles
  - Prevents over-fetching and improves initial load performance
- Search button behavior for notes
  - Opens `kind:1` notes directly via `/e/{eventId}` instead of search portal
  - Articles continue to use search portal with proper naddr encoding
  - Removes unwanted `nostr-event:` prefix from URLs
- Author profile resolution
  - Fetch author profiles from eventStore cache first before relay requests
  - Instant title updates if profile already loaded
  - Graceful fallback to short pubkey display if profile unavailable

## [0.10.7] - 2025-10-21

### Fixed

- Profile pages now display all writings correctly
  - Events are now stored in eventStore as they stream in from relays
  - `fetchBlogPostsFromAuthors` now accepts `eventStore` parameter like other fetch functions
  - Ensures all writings appear on `/p/` routes, not just the first few
  - Background fetching of highlights and writings uses consistent patterns

### Changed

- Simplified profile background fetching logic for better maintainability
  - Extracted relay URLs to variable for clarity
  - Consistent error handling patterns across fetch functions
  - Clearer comments about no-limit fetching behavior

## [0.10.6] - 2025-10-21

### Added

- Text-to-speech reliability improvements
  - Chunking support for long-form content to prevent WebSpeech API cutoffs
  - Automatic chunk-based resumption for interrupted playback
  - Better handling of content exceeding browser TTS limits

### Fixed

- Tab switching regression on `/me` page
  - Resolved infinite update loop caused by circular dependency in `useCallback` hooks
  - Tab navigation now properly updates UI when URL changes
  - Removed `loadedTabs` from dependency arrays to prevent re-render cycles
- Explore page data loading patterns
  - Implemented subscribe-first, non-blocking loading model
  - Removed all timeouts in favor of immediate subscription and progressive hydration
  - Contacts, writings, and highlights now stream results as they arrive
  - Nostrverse content loads in background without blocking UI
- Text-to-speech handler cleanup
  - Removed no-op self-assignment in rate change handler

## [0.10.4] - 2025-10-21

### Added

- Web Share Target support for PWA (system-level share integration)
  - Boris can now receive shared URLs from other apps on mobile and desktop
  - Implements POST-based Web Share Target API per Chrome standards
  - Service worker intercepts share requests and redirects to handler route
  - ShareTargetHandler component auto-saves shared URLs as web bookmarks
  - Android compatibility with URL extraction from text field when url param is missing
  - Automatic navigation to bookmarks list after successful save
  - Login prompt when sharing while logged out

### Changed

- Manifest now includes `share_target` configuration for system share menu integration
- Service worker handles POST requests to `/share-target` endpoint
- Added `/share-target` route for processing incoming shared content

## [0.10.3] - 2025-10-21

### Added

- Content filtering setting to hide articles posted by bots
  - New "Hide content posted by bots" checkbox in Explore settings (enabled by default)
  - Filters articles where author's profile name or display_name contains "bot" (case-insensitive)
  - Applies to both Explore page and Me section writings

### Fixed

- Resolved all linting and type checking issues
  - Added missing React Hook dependencies to `useMemo` and `useEffect`
  - Wrapped loader functions in `useCallback` to prevent unnecessary re-renders
  - Removed unused variables (`queryTime`, `startTime`, `allEvents`)
  - All ESLint warnings and TypeScript errors now resolved

## [0.10.2] - 2025-10-20

### Added

- Text-to-speech (TTS) speaker language selection mode
  - New "Speaker language" dropdown in TTS settings (system or content)
  - Detects content language using tinyld for accurate voice matching
  - Falls back to system language when content detection unavailable
  - Top 10 languages featured in dropdown for quick access
- TTS example text section in settings
  - Test TTS voices directly in the settings panel
  - Uses Boris mission statement as example text
  - Real-time speaker selection testing

### Changed

- TTS language selection now uses "Speaker language" terminology
  - Distinguishes between American English (en-US) and British English (en-GB)
  - Improved language detection with content-aware voice selection
  - Streamlined dropdown for better UX

### Fixed

- TTS voice detection and selection logic
  - Proper empty catch block handling instead of silently failing
  - Consistent use of `setting-select` class for dropdown styling
  - Improved dropdown spacing with adequate padding-right

## [0.10.0] - 2025-01-27

### Added

- Centralized bookmark loading with streaming and auto-decrypt
  - Bookmarks now load progressively with streaming updates
  - Auto-decrypt bookmarks as they arrive from relays
  - Individual decrypt buttons for encrypted bookmark events
  - Centralized bookmark controller for consistent loading across the app
- Enhanced debug page with comprehensive diagnostics
  - Interactive NIP-04 and NIP-44 encryption/decryption testing
  - Live performance timing with stopwatch display
  - Bookmark loading and decryption diagnostics
  - Real-time bunker logs with filtering and clearing
  - Version and git commit footer
- Bunker (NIP-46) authentication support
  - Support for remote signing via Nostr Connect protocol
  - Bunker URI input with validation and error handling
  - Automatic reconnection on app restore with proper permissions
  - Signer suggestions in error messages (Amber, nsec.app, Nostrum)

### Changed

- Improved bookmark loading performance
  - Non-blocking, progressive bookmark updates via callback pattern
  - Batched background hydration using EventLoader and AddressLoader
  - Shorter timeouts for debug page bookmark loading
  - Sequential decryption instead of concurrent to avoid queue issues
- Enhanced bunker error messages
  - Formatted error messages with signer suggestions
  - Links to nos2x, Amber, nsec.app, and Nostrum signers
  - Better error handling for missing signer extensions
- Centralized bookmark loading architecture
  - Single shared bookmark controller for consistent loading
  - Unified bookmark loading with streaming and auto-decrypt
  - Consolidated bookmark loading into single centralized function

### Fixed

- NIP-46 bunker signing and decryption
  - NostrConnectSigner properly reconnects with permissions on app restore
  - Bunker relays added to relay pool for signing requests
  - Proper setup of pool and relays before bunker reconnection
  - Expose nip04/nip44 on NostrConnectAccount for bookmark decryption
  - Cache wrapped nip04/nip44 objects instead of using getters
  - Wait for bunker relay connections before marking signer ready
  - Validate bunker URI (remote must differ from user pubkey)
  - Accept remote===pubkey for Amber compatibility
- Bookmark loading and decryption
  - Bookmarks load and complete properly with streaming
  - Auto-decrypt private bookmarks with NIP-04 detection
  - Include decrypted private bookmarks in sidebar
  - Skip background event fetching when there are too many IDs
  - Only build bookmarks from ready events (unencrypted or decrypted)
  - Restore Debug page decrypt display via onDecryptComplete callback
  - Make controller onEvent non-blocking for queryEvents completion
  - Proper timeout handling for bookmark decryption (no hanging)
  - Smart encryption detection with consistent padlock display
  - Sequential decryption instead of concurrent to avoid queue issues
  - Add extraRelays to EventLoader and AddressLoader
- TypeScript and linting errors throughout
  - Replace empty catch blocks with warnings
  - Fix explicit any types
  - Add missing useEffect dependencies
  - Resolve all linting issues in App.tsx, Debug.tsx, and async utilities

### Performance

- Non-blocking NIP-46 operations
  - Fire-and-forget NIP-46 publish for better UI responsiveness
  - Non-blocking bookmark decryption with sequential processing
  - Make controller onEvent non-blocking for queryEvents completion
- Optimized bookmark loading
  - Batched background hydration using EventLoader and AddressLoader
  - Progressive, non-blocking bookmark loading with streaming
  - Shorter timeouts for debug page bookmark loading
  - Remove artificial delays from bookmark decryption

### Refactored

- Centralized bookmark controller architecture
  - Extract bookmark streaming helpers and centralize loading
  - Consolidated bookmark loading into single function
  - Remove deprecated bookmark service files
  - Share bookmark controller between components
- Debug page organization
  - Extract VersionFooter component to eliminate duplication
  - Structured sections with proper layout and styling
  - Apply settings page styling structure
- Simplified bunker implementation following applesauce patterns
  - Clean up bunker implementation for better maintainability
  - Import RELAYS from central config (DRY principle)
  - Update RELAYS list with relay.nsec.app

### Documentation

- Comprehensive Amber.md documentation
  - Amethyst-style bookmarks section
  - Bunker decrypt investigation summary
  - Critical queue disabling requirement
  - NIP-46 setup and troubleshooting

## [0.9.1] - 2025-10-20

### Added

- Video embedding for nostr-native content
  - Detect and embed `<video>...</video>` blocks (including nested `<source>`)
  - Detect and embed `<img src="…(mp4|webm|ogg|mov|avi|mkv|m4v)">` tags
  - Detect and embed bare video file URLs and platform-classified video links
- Media display settings
  - New "Render video links as embeds" setting (defaults to enabled)
  - New "Full-width images" display option
  - Dedicated "Media Display" settings section
- Article view improvements
  - Center images by default in reader
  - Writings list sorted by publication date (newest first)

### Changed

- Enable media display options by default for a better out‑of‑the‑box experience
- Constrain video player to reader width to prevent horizontal overflow

### Fixed

- Prevent double video player rendering when both processor and panel attempted to embed
- Remove text artifacts and broken tags when converting markdown image/video URLs
  - Improved URL regex and robust tag replacement
  - Avoid injecting unknown img props from markdown renderer
- Resolved remaining ESLint and TypeScript issues

### Performance

- Optimized Support page loading with instant display and skeletons

## [0.9.0] - 2025-01-20

### Added

- User relay list integration (NIP-65) and blocked relays (NIP-51)
  - Automatically loads user's relay list from kind 10002 events
  - Supports blocked relay filtering from kind 10006 mute lists
  - Integrates with existing relay pool for seamless user experience
- Relay list debug section in Debug component
  - Enhanced debugging capabilities for relay list loading
  - Detailed logging for relay query diagnostics

### Changed

- Improved relay list loading performance
  - Added streaming callback to relay list service for faster results
  - User relay list now streams into pool immediately and finalizes after blocked relays
  - Made relay list loading non-blocking in App.tsx
- Enhanced relay URL handling
  - Normalized relay URLs to match applesauce-relay internal format
  - Removed relay.dergigi.com from default relays
  - Use user's relay list exclusively when logged in

### Fixed

- Resolved all linting issues across the codebase
- Fixed TypeScript type issues in relayListService
  - Replaced any types with proper NostrEvent types
  - Improved type safety and code quality
- Cleaned up temporary test relays from hardcoded list
- Removed non-relay console.log statements and debug output

### Technical

- Enhanced relay initialization logging for better diagnostics
- Improved error handling and timeout management for relay queries
- Better separation of concerns between relay loading and application startup

## [0.8.6] - 2025-10-20

### Fixed

- React Hooks violations in NostrMentionLink component
  - Fixed useEffect dependency warnings by removing isMounted from dependencies
  - Reverted to inline mount tracking with useRef for safer lifecycle handling

## [0.8.4] - 2024-10-20

### Added

- Progressive article hydration for reads tab
  - Articles now load titles, summaries, images, and author information progressively
  - Implemented readsController following the same pattern as bookmarkController
  - Uses AddressLoader for efficient batched article event retrieval
  - Articles rehydrate as data arrives from relays without blocking initial display
  - Event store integration for caching article events
  - Centralized reads data fetching following DRY principles

### Fixed

- Fixed React type imports in useArticleLoader
  - Import `Dispatch` and `SetStateAction` directly from 'react' instead of using `React.` prefix
  - Resolves ESLint no-undef errors

## [0.8.3] - 2025-01-19

### Fixed

- Highlight creation now shows immediate UI feedback without page refresh
  - Fixed streaming highlight merge logic to preserve newly created highlights
  - Decoupled cached highlight sync from content loading to prevent unintended reloads
  - Newly created highlights appear instantly in both reader and highlights panel
  - Highlights remain visible while remote results stream in and merge properly

### Changed

- Improved highlight creation user experience
  - Selection clearing and synchronous rendering for immediate highlight display
  - Better error handling for bunker permission issues with user-friendly messages

## [0.8.2] - 2025-10-19

### Added

- Reading progress indicator in compact bookmark cards
  - Shows progress bar for articles and web bookmarks with reading data
  - Progress bar aligned with bookmark text for better visual association
  - Color-coded progress (blue for reading, green for completed, gray for started)

### Changed

- Compact cards layout optimizations for more space-efficient display
  - Reduced vertical padding from 0.5rem to 0.25rem
  - Reduced compact row height from 28px to 24px
  - Reduced gap between compact cards from 0.5rem to 0.25rem
- Reading progress bar styling for compact view
  - Bar height reduced from 2px to 1px for more subtle appearance
  - Left margin of 1.5rem aligns bar with bookmark text instead of appearing as separator

### Fixed

- Removed borders from compact bookmarks in bookmarks sidebar
  - Border styling from `.bookmarks-list` no longer applies to compact cards
  - Compact cards now display as truly borderless and transparent

## [0.8.0] - 2025-10-19

### Added

- Centralized reading progress controller for non-blocking reading position sync
  - Progressive loading with caching from event store
  - Streaming updates from relays with proper merging
  - 2-second completion hold at 100% reading position to prevent UI jitter
  - Configurable auto-mark-as-read at 100% reading progress
- Reading progress indicators on blog post cards
  - Visual progress bars on article cards in Explore and bookmarks sidebar
  - Persistent reading position synced across devices via NIP-85

### Changed

- Reading position sync now enabled by default in runtime paths
- Improved auto-mark-as-read behavior with reliable completion detection
- Reading progress events use proper NIP-85 specification (kind 39802)

### Fixed

- Reading position saves with proper validation and event store integration
- Profile page writings loading now fetches all writings without limits
- Consistent reading progress calculation and event publishing

### Performance

- Non-blocking reading progress controller with streaming updates
- Cache-first loading strategy with local event store before relay queries
- Efficient progress merging and deduplication

## [0.7.4] - 2025-10-18

### Added

- Profile page data preloading for instant tab switching
  - Automatically preloads all highlights and writings when viewing a profile (`/p/` pages)
  - Non-blocking background fetch stores all events in event store
  - Tab switching becomes instant after initial preload

### Changed

- `/me/bookmarks` tab now displays in cards view only
  - Removed view mode toggle buttons (compact, large) from bookmarks tab
  - Cards view provides optimal bookmark browsing experience
  - Grouping toggle (grouped/flat) still available
- Highlights sidebar filters simplified when logged out
  - Only nostrverse filter button shown when not logged in
  - Friends and personal highlight filters hidden when logged out
  - Cleaner UX showing only available options

### Fixed

- Profile page tabs now display cached content instantly
  - Highlights and writings show immediately from event store cache
  - Network fetches happen in background without blocking UI
  - Matches Explore and Debug page non-blocking loading pattern
  - Eliminated loading delays when switching between tabs

### Performance

- Cache-first profile loading strategy
  - Instant display of cached highlights and writings from event store
  - Background refresh updates data without blocking
  - Tab switches show content immediately without loading states

## [0.7.3] - 2025-10-18

### Added

- Centralized nostrverse writings controller for kind 30023 content
  - Automatically starts at app initialization
  - Streams nostrverse blog posts progressively to Explore page
  - Provides non-blocking, cache-first loading strategy
- Centralized nostrverse highlights controller
  - Pre-loads nostrverse highlights at app start for instant toggling
  - Streams highlights progressively to Explore page
  - Integrated with EventStore for caching
- Writings loading debug section on `/debug` page
  - Diagnostics for writings controller and loading states

### Changed

- Explore page now uses centralized `writingsController` for user's own writings
  - Auto-loads user writings at login for instant availability
  - Non-blocking fetch with progressive streaming
- Explore page loading strategy optimized
  - Shows skeleton placeholders instead of blocking spinners
  - Seeds from cache, then streams and merges results progressively
  - Keeps nostrverse fetches non-blocking
- User's own writings now included in Explore when enabled
  - Lazy-loads on 'mine' toggle when logged in
  - Streams in parallel with friends/nostrverse content

### Fixed

- Explore page works correctly in logged-out mode
  - Relies solely on centralized nostrverse controllers
  - Controllers start even when logged out
  - Fetches nostrverse content properly without authentication
- Explore page no longer allows disabling all scope filters
  - Ensures at least one filter (mine/friends/nostrverse) remains active
  - Prevents blank content state
- Explore page reflects default scope setting immediately
  - No more blank lists on initial load
  - Pre-loads and merges nostrverse from event store
- Explore page highlights properly scoped
  - Nostrverse highlights never block the page
  - Shows empty state instead of spinner
  - Streams results into store immediately
  - Highlights are merged and loaded correctly
- Article-specific highlights properly filtered
  - Highlights scoped to current article on `/a/` and `/r/` routes
  - Derives coordinate from naddr for early filtering
  - Sidebar and content only show relevant highlights
  - ContentPanel shows only article-specific highlights for nostr articles
- Explore writings properly deduplicated
  - Deduplication by replaceable event (author:d-tag) happens before visibility filtering
  - Consistent dedupe/sort behavior across all loading scenarios
- Debug page writings loading section added
  - No infinite loop when loading nostrverse content

### Performance

- Non-blocking explore page loading
  - Fully non-blocking loading strategy
  - Seeds caches then streams and merges results progressively
- Lazy-loading for content filters
  - Nostrverse writings lazy-load when toggled on while logged in
  - Avoids redundant loading with guard flags
- Streaming callbacks for progressive updates
  - Writings stream to UI via onPost callback
  - Posts appear instantly as they arrive from cache or network

## [0.7.2] - 2025-01-27

### Added

- Cached-first loading with EventStore across the app
  - Instant display of cached highlights and writings from local event store
  - Progressive loading with streaming updates from relays
  - Centralized event storage for improved performance and offline support
- Default explore scope setting for controlling content visibility
  - Configurable default scope for explore page content
  - Dedicated Explore section in settings for better organization

### Changed

- Highlights and writings now load from cache first, then stream from relays
- Explore page shows cached content instantly before network updates
- Article-specific highlights stored in centralized event store for faster access
- Nostrverse content cached locally for improved performance

### Fixed

- Prevent "No highlights yet" flash on `/me/highlights` page
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
  - Support for remote signing via Nostr Connect protocol
  - Bunker URI input with validation and error handling
  - Automatic reconnection on app restore with proper permissions
  - Signer suggestions in error messages (Amber, nsec.app, Nostrum)
- Debug page (`/debug`) for diagnostics and testing
  - Interactive NIP-04 and NIP-44 encryption/decryption testing
  - Live performance timing with stopwatch display
  - Bookmark loading and decryption diagnostics
  - Real-time bunker logs with filtering and clearing
  - Version and git commit footer
- Progressive bookmark loading with streaming updates
  - Non-blocking, progressive bookmark updates via callback pattern
  - Batched background hydration using EventLoader and AddressLoader
  - Auto-decrypt bookmarks as they arrive from relays
  - Individual decrypt buttons for encrypted bookmark events
- Bookmark grouping toggle (grouped by source vs flat chronological)
  - Toggle between grouped view and flat chronological list
  - Amethyst-style bookmark detection and grouping
  - Display bookmarks even when they only have IDs (content loads in background)

### Changed

- Improved login UI with better copy and modern design
  - Personable title and nostr-native language
  - Highlighted 'your own highlights' in login copy
  - Simplified button text to single words (Extension, Signer)
  - Hide login button and user icon when logged out
  - Hide Extension button when Bunker input is shown
  - Auto-load bookmarks on login and page mount
- Enhanced bunker error messages
  - Formatted error messages with signer suggestions
  - Links to nos2x, Amber, nsec.app, and Nostrum signers
  - Better error handling for missing signer extensions
  - Centered and constrained bunker input field
- Centralized bookmark loading architecture
  - Single shared bookmark controller for consistent loading
  - Unified bookmark loading with streaming and auto-decrypt
  - Consolidated bookmark loading into single centralized function
  - Bookmarks passed as props throughout component tree
- Renamed UI elements for clarity
  - "Bunker" button renamed to "Signer"
  - Hide bookmark controls when logged out
- Settings version footer improvements
  - Separate links for version (to GitHub release) and commit (to commit page)
  - Proper spacing around middot separator

### Fixed

- NIP-46 bunker signing and decryption
  - NostrConnectSigner properly reconnects with permissions on app restore
  - Bunker relays added to relay pool for signing requests
  - Proper setup of pool and relays before bunker reconnection
  - Expose nip04/nip44 on NostrConnectAccount for bookmark decryption
  - Cache wrapped nip04/nip44 objects instead of using getters
  - Wait for bunker relay connections before marking signer ready
  - Validate bunker URI (remote must differ from user pubkey)
  - Accept remote===pubkey for Amber compatibility
- Bookmark loading and decryption
  - Bookmarks load and complete properly with streaming
  - Auto-decrypt private bookmarks with NIP-04 detection
  - Include decrypted private bookmarks in sidebar
  - Skip background event fetching when there are too many IDs
  - Only build bookmarks from ready events (unencrypted or decrypted)
  - Restore Debug page decrypt display via onDecryptComplete callback
  - Make controller onEvent non-blocking for queryEvents completion
  - Proper timeout handling for bookmark decryption (no hanging)
  - Smart encryption detection with consistent padlock display
  - Sequential decryption instead of concurrent to avoid queue issues
  - Add extraRelays to EventLoader and AddressLoader
- PWA cache limit increased to 3 MiB for larger bundles
- Extension login error messages with nos2x link
- TypeScript and linting errors throughout
  - Replace empty catch blocks with warnings
  - Fix explicit any types
  - Add missing useEffect dependencies
  - Resolve all linting issues in App.tsx, Debug.tsx, and async utilities

### Performance

- Non-blocking NIP-46 operations
  - Fire-and-forget NIP-46 publish for better UI responsiveness
  - Non-blocking bookmark decryption with sequential processing
  - Make controller onEvent non-blocking for queryEvents completion
- Optimized bookmark loading
  - Batched background hydration using EventLoader and AddressLoader
  - Progressive, non-blocking bookmark loading with streaming
  - Shorter timeouts for debug page bookmark loading
  - Remove artificial delays from bookmark decryption

### Refactored

- Centralized bookmark controller architecture
  - Extract bookmark streaming helpers and centralize loading
  - Consolidated bookmark loading into single function
  - Remove deprecated bookmark service files
  - Share bookmark controller between components
- Debug page organization
  - Extract VersionFooter component to eliminate duplication
  - Structured sections with proper layout and styling
  - Apply settings page styling structure
- Simplified bunker implementation following applesauce patterns
  - Clean up bunker implementation for better maintainability
  - Import RELAYS from central config (DRY principle)
  - Update RELAYS list with relay.nsec.app

### Documentation

- Comprehensive Amber.md documentation
  - Amethyst-style bookmarks section
  - Bunker decrypt investigation summary
  - Critical queue disabling requirement
  - NIP-46 setup and troubleshooting

## [0.6.24] - 2025-01-16

### Fixed

- TypeScript global declarations for build-time defines
  - Added proper type declarations for `__APP_VERSION__`, `__GIT_COMMIT__`, `__GIT_BRANCH__`, `__BUILD_TIME__`, and `__GIT_COMMIT_URL__`
  - Resolved ESLint no-undef errors for build-time injected variables
  - Added Node.js environment hint to Vite configuration

## [0.6.23] - 2025-01-16

### Fixed

- Deep-link refresh redirect issue for nostr-native articles
  - Limited `/a/:naddr` rewrite to bot user-agents only in Vercel configuration
  - Real browsers now hit the SPA directly, preventing redirect to root path
  - Bot crawlers still receive proper OpenGraph metadata for social sharing

### Added

- Version and git commit information in Settings footer
  - Displays app version and short commit hash with link to GitHub
  - Build-time metadata injection via Vite configuration
  - Subtle footer styling with selectable text

### Changed

- Article OG handler now uses proper RelayPool.request() API
  - Aligned with applesauce RelayPool interface
  - Removed deprecated open/close methods
  - Fixed TypeScript linting errors

### Technical

- Added debug logging for route state and article OG handler
  - Gated by `?debug=1` query parameter for production testing
  - Structured logging for troubleshooting deep-link issues
  - Temporary debug components for validation

## [0.6.22] - 2025-10-16

### Added

- Dynamic OpenGraph and Twitter Card meta tags for article deep-links
  - Social media platforms display article title, author, cover image, and summary when sharing `/a/{naddr}` links
  - Serverless endpoint fetches article metadata from Nostr relays (kind:30023) and author profiles (kind:0)
  - User-agent detection serves appropriate content to crawlers vs browsers
  - Falls back to default social preview image when articles have no cover image
- Social preview image for homepage and article links
  - Added `boris-social-1200.png` as default OpenGraph image (1200x630)
  - Homepage now includes social preview image in meta tags

### Changed

- Article deep-links now properly preserve URL when loading in browser
  - Uses `history.replaceState()` to maintain correct article path
  - Browser navigation works correctly on refresh and new tab opens

### Fixed

- Vercel rewrite configuration for article routes
  - Routes `/a/:naddr` to serverless OG endpoint for dynamic meta tags
  - Regular SPA routing preserved for browser navigation

## [0.6.21] - 2025-10-16

### Added

- Reading position sync across devices using Nostr Kind 30078 (NIP-78)
  - Automatically saves and syncs reading position as you scroll
  - Visual reading progress indicator on article cards
  - Reading progress shown in Explore and Bookmarks sidebar
  - Auto-scroll to last reading position setting (configurable in Settings)
  - Reading position displayed as colored progress bar on cards
- Reading progress filters for organizing articles
  - Filter by reading state: Unopened, Started (0-10%), Reading (11-94%), Completed (95-100% or marked as read)
  - Filter icons colored when active (blue for most, green for completed)
  - URL routing support for reading progress filters
  - Reading progress filters available in Archive tab and bookmarks sidebar
- Reads and Links tabs on `/me` page
  - Reads tab shows nostr-native articles with reading progress
  - Links tab shows external URLs with reading progress
  - Both tabs populate instantly from bookmarks for fast loading
  - Lazy loading for improved performance
- Auto-mark as read at 100% reading progress
  - Articles automatically marked as read when scrolled to end
  - Marked-as-read articles treated as 100% progress
  - Fancy checkmark animation on Mark as Read button
- Click-to-open article navigation on highlights
  - Clicking highlights in Explore and Me pages opens the source article
  - Automatically scrolls to highlighted text position

### Changed

- Renamed Archive to Reads with expanded functionality
- Merged 'Completed' and 'Marked as Read' filters into one unified filter
- Simplified filter icon colors to blue (except green for completed)
- Started reading progress state (0-10%) uses neutral text color
- Replace spinners with skeleton placeholders during refresh in Archive/Reads/Links tabs
- Removed unused IEventStore import in ContentPanel

### Fixed

- Reading position calculation now accurately reaches 100%
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

- Bookmark filter buttons by content type (articles, videos, images, web links)
  - Filter bookmarks by their content type on bookmarks sidebar
  - Filters also available on `/me` page bookmarks tab
  - Separate filter for external articles with link icon
  - Multiple filters can be active simultaneously
- Private Bookmarks section for encrypted legacy bookmarks
  - Encrypted legacy bookmarks now grouped in separate section
  - Better organization and clarity for different bookmark types

### Changed

- Bookmark section labels improved for clarity
  - More descriptive section headings throughout
  - Better categorization of bookmark types
- Bookmark filter button styling refined
  - Reduced whitespace around bookmark filters for cleaner layout
  - Dramatically reduced whitespace on both sidebar and `/me` page
- Lock icon removed from individual bookmarks
  - Encryption status now indicated by section grouping
  - Cleaner bookmark item appearance
- External article icon changed to link icon (`faLink`)
  - More intuitive icon for external content

### Fixed

- Highlight button positioning and visibility
  - Fixed to viewport for consistent placement
  - Sticky and always visible when needed
  - Properly positioned inside reader pane

## [0.6.19] - 2025-10-15

### Fixed

- Highlights disappearing on external URLs after a few seconds
  - Fixed `useBookmarksData` from fetching general highlights when viewing external URLs
  - External URL highlights now managed exclusively by `useExternalUrlLoader`
  - Removed redundant `setHighlights` call that was overwriting streamed highlights
  - Improved error handling in `fetchHighlightsForUrl` to prevent silent failures
  - Isolated rebroadcast errors so they don't break highlight display
  - Added logging to help diagnose highlight fetching issues

## [0.6.18] - 2025-10-15

### Changed

- Zap split labels simplified and terminology updated
  - Removed redundant "Weight: xy" label to save space
  - Changed "Author(s) Share" to "Author's Share" (possessive singular)
  - Changed "Support Boris" to "Boris' Share" for consistency
  - Weight value now shown directly in label (e.g., "Your Share: 50")
  - Share and percentage now displayed on same line for cleaner layout
- Zap preset buttons on desktop now expand to match slider width
  - Added `flex: 1` to buttons for equal width distribution
  - Buttons still wrap properly on smaller screens
- PWA install section now always visible in settings
  - Section shows regardless of installation or device capability status
  - Button adapts with proper disabled states and visual feedback
  - "Installed" state shows checkmark icon and disabled button
  - Non-installable state shows disabled button

### Fixed

- PWA install button now properly disabled when installation is not possible on device
  - Button only enabled when browser fires `beforeinstallprompt` event
  - Removed hardcoded testing state that always showed button as installable
- App & Airplane Mode section now always visible regardless of PWA status
  - Image cache and local relay settings always accessible
  - Previously entire section was hidden if PWA not installable/installed
  - Only PWA-specific install button is conditionally affected

## [0.6.17] - 2025-10-15

### Added

- PWA settings illustration (`pwa.svg`) displayed on right side of section
  - Responsive design: hidden on mobile, 30% width on desktop
  - Visual enhancement for App & Airplane Mode section
- Zaps illustration (`zaps.svg`) displayed on right side of Zap Splits section
  - Matching responsive layout and styling as PWA illustration
- Visual 50% indicators on zap split sliders
  - Linear gradient background using highlight colors (yellow/orange) at 50% opacity
  - Datalist tick marks at 50% for "Your Share" and "Author(s) Share" sliders
  - Tick mark at 5 for "Support Boris" slider
- Lightning bolt icons as slider thumbs for zap splits
  - Replaces default circular slider handles
  - White lightning bolt SVG embedded in slider thumb background
  - 24px square thumb with 4px border radius
- Offline-first description paragraph at beginning of App & Airplane Mode section
  - Explains Boris's offline capabilities upfront
- Settings page width constraint (900px max-width)
  - Matches article view max-width for consistent reading experience
  - Centered layout with proper margins

### Changed

- Settings section reorganization
  - "PWA & Flight Mode" merged into single "App & Airplane Mode" section
  - "Layout & Navigation" and "Startup & Behavior" merged into "Layout & Behavior"
  - Section order: Theme → Reading & Display → Zap Splits → Layout & Behavior → App & Airplane Mode → Relays
  - "Startup & Behavior" moved after "Zap Splits"
  - "Layout & Navigation" moved below "Zap Splits"
- PWA settings section restructure
  - Checkboxes moved to top (image cache, local relays)
  - Descriptive paragraphs in middle
  - Install button at bottom
  - Note about local relays moved before install paragraph
- Zap split sliders styling
  - Left side (0-50%): highlight color (yellow) at 50% opacity
  - Right side (50-100%): friend-highlight color (orange) at 50% opacity
  - Creates visual distinction tied to app's highlight color scheme
- Zap split description text styling
  - Now matches offline-first paragraph style with secondary color and smaller font size
- Clear cache button styling
  - Replaced `IconButton` with plain `FontAwesomeIcon` for subtler appearance
  - No border or background, just icon with opacity
- Font Size buttons alignment
  - Now properly align to the right using `setting-control` wrapper
  - Matches alignment of highlight color picker buttons
- Default Highlight Visibility position
  - Moved back to original position after "Paragraph Alignment"
  - Grouped with other reading display controls
- Spacing adjustments in App & Airplane Mode section
  - Reduced gap between elements from 1rem → 0.5rem → 0.25rem for tighter layout

### Fixed

- PWA settings paragraph wrapping
  - Moved offline-first paragraph inside flex container to prevent extending above image
- Font Size buttons alignment issues
  - Properly implemented `setting-control` wrapper for right alignment
  - Previously attempted alignment didn't work correctly
- Slider thumb icon centering
  - Lightning bolt icons properly centered vertically on slider
  - Added `position: relative`, `top: 0`, `margin-top: 0` for accurate positioning

## [0.6.16] - 2025-10-15

### Changed

- Replaced delete dialog popup with inline confirmation UI
  - Shows red "Confirm?" text with trash icon when delete is clicked
  - Clicking the red trash icon confirms deletion
  - No more modal overlay or backdrop
  - Click outside or reopen menu to cancel
- Reordered Reading & Display settings for better organization
  - Highlight Style, Paragraph Alignment, and Default Highlight Visibility moved to top
  - Followed by Reading Font, Font Size, and color pickers
- Setting buttons now align vertically with fixed label width (220px)
  - Creates consistent "tab stops" for cleaner visual alignment

### Fixed

- Removed unused `handleCancelDelete` function after dialog removal

## [0.6.15] - 2025-10-15

### Added

- Paragraph alignment setting with left-aligned and justified text options
  - Icon buttons in Reading & Display settings for switching alignment
  - CSS variable system for applying alignment to reader content
  - Real-time preview of alignment changes in settings
  - Headings remain left-aligned for optimal readability

### Changed

- Default paragraph alignment changed to justified for improved reading experience
  - Applies to paragraphs, list items, divs, and blockquotes
  - Settings stored and synced via Nostr (NIP-78)

## [0.6.14] - 2025-10-15

### Added

- Support for bookmark sets (NIP-51 kind:30003)
  - Bookmark sets now display alongside regular bookmark lists
  - Properly handles AddressPointer bookmarks for long-form articles
- Content type icons for bookmarks
  - Article, video, web, and image icons to indicate bookmark content type
  - Camera icon for image bookmarks
  - Sticky note icon for text-only bookmarks without URLs
- Bookmark grouping and sections
  - Grouped sections in sidebar and `/me` reading-list
  - Web bookmarks, default bookmarks, and legacy bookmarks in separate sections
  - Grouping and sorting helpers for organizing bookmark sections
- Adaptive text color for publication date over hero images
  - Automatically detects image brightness and adjusts text color
  - Improved contrast for better readability

### Changed

- Renamed "Amethyst-style bookmarks" to "Old Bookmarks (Legacy)"
- Hide cover images in compact view for cleaner layout
- Support button improvements
  - Moved to bottom-left of bookmarks bar
  - Changed icon from lightning bolt to heart (orange color)
  - Left-aligned support button, right-aligned view mode buttons
- Section headings improved with better typography (removed counts)
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
- Section heading styles now properly override with `!important`
- Removed unused articleImage prop from CompactView

## [0.6.13] - 2025-10-15

### Added

- Support for `nprofile` identifiers on `/p/` profile pages (NIP-19)
  - Profile pages now accept both `npub` and `nprofile` identifiers
  - Extracts pubkey from nprofile data structure
  - Users can share profiles with relay metadata included
- Gradient placeholder images for articles without cover images
  - Blog post cards show subtle diagonal gradient using theme colors
  - Reader view displays gradient background with newspaper icon
  - Placeholders adapt automatically to light/dark themes
  - Large view bookmarks use matching gradient backgrounds

### Changed

- PWA install section styling in settings
  - Heading now matches other section headings with proper styling
  - Install button uses standard app button styling instead of custom gradient
  - Consistent with app's design system and theme colors

### Fixed

- Mobile bookmark button visibility across all pages
  - Now visible on `/p/` (profile), `/explore`, `/me`, and `/support` pages
  - Only hidden on settings page or when scrolling down while reading
  - Prevents users from getting stuck without navigation options
- Mobile highlights button behavior at page top
  - Hidden when scrolled to the very top of the page
  - Appears when scrolling up from below
  - Bookmark button remains visible at top (only hides on scroll down)
  - Separate visibility logic for each button improves UX

## [0.6.12] - 2025-10-15

### Changed

- Horizontal dividers (`<hr>`) in blog posts now display with more subtle styling
  - Reduced visual weight with 69% opacity for better readability
  - Added increased vertical padding (2.5rem) above and below dividers
  - Improved visual separation without disrupting reading flow

## [0.6.11] - 2025-10-15

### Added

- Colored borders to blog post and highlight cards based on relationship
  - Mine: yellow border
  - Friends: orange border
  - Nostrverse: purple border
  - Visual distinction helps identify content source at a glance
- Mobile sidebar toggle buttons on explore page
  - Bookmark and highlights buttons now visible on explore page
  - Improves mobile navigation UX

### Fixed

- Mobile bookmarks sidebar opening and closing immediately
  - Memoized `toggleSidebar` function to prevent unnecessary re-renders
  - Updated route-change effect to only close sidebar on actual pathname changes
  - Sidebar now stays open when opened on mobile PWA

## [0.6.10] - 2025-10-15

### Added

- Support page (`/support`) displaying zappers with avatar grid
  - Shows "Absolute Legends" (69420+ sats) and regular supporters (2100+ sats)
  - Clickable supporter avatars link to profiles
  - Bolt icon button in sidebar navigation
  - Thank-you illustration and call-to-action
  - Links to pricing page and Boris profile
- Refresh button to explore page
  - Positioned next to filter buttons
  - Spinning animation during loading and pull-to-refresh
- Unified event publishing and querying services
  - `publishEvent` service for highlights and settings
  - `queryEvents` helper with local-first fetching
  - Centralized relay timeouts configuration
- FEATURES.md documentation file
- MIT License

### Changed

- Explore page improvements
  - Filter defaults to friends only (instead of all)
  - Tabs moved below filter buttons
  - Filter buttons positioned on the right
  - Writings tab now uses newspaper icon
  - Subtitle removed for cleaner layout
- Pull-to-refresh library
  - Replaced custom implementation with `use-pull-to-refresh`
  - Updated HighlightsPanel to use new library
- Loading states now show progressive loading with skeletons instead of blocking error screens
- All event fetching services migrated to unified `queryEvents` helper
  - `nostrverseService`, `bookmarkService`, `libraryService`
  - `exploreService`, `fetchHighlightsFromAuthors`
- Contact streaming with extended timeout and partial results

### Fixed

- All ESLint and TypeScript linting errors
  - Removed all `eslint-disable` statements
  - Fixed `react-hooks/exhaustive-deps` warnings
  - Resolved all type errors
- Explore page refresh loop and false empty-follows error
- Zap receipt scanning with applesauce helpers and more relays
- Support page theme colors for proper readability

### Refactored

- Event publishing to use unified `publishEvent` service
- Event fetching to use unified `queryEvents` helper
- Image cache and bookmark components (removed unused settings parameter)
- Support page spacing and visual hierarchy

## [0.6.9] - 2025-10-14

### Documentation

- Minor changelog formatting updates

## [0.6.8] - 2025-10-14

### Changed

- Updated favicon and app icons to purple theme
  - Replaced all 8 icon files (apple-touch-icon, favicon variants, and Android Chrome icons)
  - New purple color scheme for better brand recognition

## [0.6.7] - 2025-10-14

### Added

- Skeleton loading placeholders using `react-loading-skeleton` package
  - Replaced loading spinners with skeleton loaders across all major components
  - BookmarkList, Explore, Me, ContentPanel, and HighlightsPanel now use skeleton placeholders
  - Theme-aware skeleton animations matching app color scheme
- Nostr identifier parsing and rendering in highlight comments
  - Support for `nostr:npub`, `nostr:nprofile`, `nostr:naddr`, `nostr:note`, `nostr:nevent`
  - Clickable links to profiles and articles from highlight comments
  - Shortened display format for better readability
- Visibility filters for explore page content
  - Toggle filters for nostrverse, friends, and own content
  - Icon buttons with color coding matching highlight levels
  - Filter state persists across tab switches

### Changed

- Loading states now use skeleton placeholders instead of spinners for more polished UX
- Removed incremental loading spinner from explore page refresh
  - Pull-to-refresh indicator provides refresh state feedback

### Fixed

- Type error in `HighlightItem.tsx` using `React.ReactElement` instead of `JSX.Element`
- Me page skeleton loading now handles undefined `viewingPubkey` gracefully

### Documentation

- Updated FontAwesome rule to prefer skeleton placeholders over loading text or spinners

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

[Unreleased]: https://github.com/dergigi/boris/compare/v0.10.4...HEAD
[0.10.4]: https://github.com/dergigi/boris/compare/v0.10.3...v0.10.4
[0.10.3]: https://github.com/dergigi/boris/compare/v0.10.2...v0.10.3
[0.10.2]: https://github.com/dergigi/boris/compare/v0.10.1...v0.10.2
[0.10.1]: https://github.com/dergigi/boris/compare/v0.10.0...v0.10.1
[0.10.0]: https://github.com/dergigi/boris/compare/v0.9.1...v0.10.0
[0.9.1]: https://github.com/dergigi/boris/compare/v0.9.0...v0.9.1
[0.8.3]: https://github.com/dergigi/boris/compare/v0.8.2...v0.8.3
[0.8.2]: https://github.com/dergigi/boris/compare/v0.8.0...v0.8.2
[0.8.0]: https://github.com/dergigi/boris/compare/v0.7.4...v0.8.0
[0.7.4]: https://github.com/dergigi/boris/compare/v0.7.3...v0.7.4
[0.7.3]: https://github.com/dergigi/boris/compare/v0.7.2...v0.7.3
[0.7.2]: https://github.com/dergigi/boris/compare/v0.7.0...v0.7.2
[0.7.0]: https://github.com/dergigi/boris/compare/v0.6.24...v0.7.0
[0.6.24]: https://github.com/dergigi/boris/compare/v0.6.23...v0.6.24
[0.6.23]: https://github.com/dergigi/boris/compare/v0.6.22...v0.6.23
[0.6.21]: https://github.com/dergigi/boris/compare/v0.6.20...v0.6.21
[0.6.20]: https://github.com/dergigi/boris/compare/v0.6.19...v0.6.20
[0.6.19]: https://github.com/dergigi/boris/compare/v0.6.18...v0.6.19
[0.6.18]: https://github.com/dergigi/boris/compare/v0.6.17...v0.6.18
[0.6.17]: https://github.com/dergigi/boris/compare/v0.6.16...v0.6.17
[0.6.16]: https://github.com/dergigi/boris/compare/v0.6.15...v0.6.16
[0.6.15]: https://github.com/dergigi/boris/compare/v0.6.14...v0.6.15
[0.6.14]: https://github.com/dergigi/boris/compare/v0.6.13...v0.6.14
[0.6.13]: https://github.com/dergigi/boris/compare/v0.6.12...v0.6.13
[0.6.12]: https://github.com/dergigi/boris/compare/v0.6.11...v0.6.12
[0.6.11]: https://github.com/dergigi/boris/compare/v0.6.10...v0.6.11
[0.6.10]: https://github.com/dergigi/boris/compare/v0.6.9...v0.6.10
[0.6.9]: https://github.com/dergigi/boris/compare/v0.6.8...v0.6.9
[0.6.8]: https://github.com/dergigi/boris/compare/v0.6.7...v0.6.8
[0.6.7]: https://github.com/dergigi/boris/compare/v0.6.6...v0.6.7
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
