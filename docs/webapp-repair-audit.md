# Web app repair audit — 2026-09-10

This is the first stability pass, before Android feature parity. No deployment or GitHub PR merges were performed.

## Findings addressed

| Failure | Repair |
| --- | --- |
| Every ordinary web article depended on `r.jina.ai`; no deadline, weak response validation, and raw error/page bodies could be cached. | `/api/reader` fetches the source directly and extracts locally with Mozilla Readability. There is no Jina fallback or API key. |
| `npm run dev` did not serve serverless article extraction. | The same reader handler runs under Vite development/preview and Vercel. API routes are excluded from the SPA rewrite. |
| External articles waited for Nostr relays, and reactive highlight updates restarted content loading. | Independent content/highlight effects, cancellation on navigation, and cache updates without refetching articles. |
| The inactive Nostr article loader could clear another loader's content as relays changed. Cached article highlight callbacks survived navigation. | Inactive loaders leave content alone; all article paths, including cache hits, have request-scoped cleanup. |
| Relay query helpers removed EOSE before checking it. Queries hung or waited for fallback deadlines. | EOSE is checked before filtering events; the unified query has a 10-second deadline and retains partial results. |
| Newer streamed article versions were rendered but not always persisted. | Cache the final newest version; background updates cannot roll back to an intermediate version. |
| HTML reached `dangerouslySetInnerHTML` without sanitization, including old cached content. Raw Markdown HTML also rendered in the hidden preview. | Sanitize extracted HTML server-side, sanitize HTML at the display boundary, and sanitize Markdown HTML before its hidden render. |
| Failed extraction looked like article content; expired web caches were deleted before offline fallback. | Explicit error/retry/open-original UI; validated cached articles survive expiry and can be used on failure with a saved-copy notice. |
| Background Nostr article caching could exhaust localStorage before a viewed web article was saved. | Bound combined article storage to 100 entries / 1.5 million UTF-16 units, evict old background articles first, and never evict accounts/settings. |
| Offline app-shell fallback missed Workbox's revisioned cache keys; image-cache validation rejected opaque cross-origin responses. | Use `matchPrecache`, bound navigation fetches, and honor the configured opaque-image caching policy. |
| Service worker registration could keep using an obsolete/dev script. | Register the current script on each load, use Vite's actual development worker URL, and catch update failures. |
| Installed dependencies were older than the lockfile and caused TypeScript failures. | A clean `npm ci` restored the baseline build. Add Node 22 selection, automated tests, server type checking, and CI lint/test/build checks. |

The reader endpoint accepts only public HTTP(S) pages on standard ports. It validates DNS answers and pins the socket address, repeats validation for redirects, limits redirects and decompressed bytes, and applies a total fetch deadline. Source scripts and remote DOM resources are not executed. Responses use `no-store`; article caching is local to the browser. Versioned cache keys avoid trusting old Jina error/page payloads.

## Validation

- All 62 regression tests pass on Node 22. Tests cover extraction/sanitization, relative images and links, compressed/non-UTF8 responses, redirects, private IP/DNS targets, size limits, malformed responses, cache failures, timeout completion, and both external and cached Nostr navigation races.
- TypeScript checks cover the client and the new reader server code; production build and ESLint checks pass.
- Chrome smoke tests cover the Explore homepage, a complete directly fetched article, and the error/retry/original-link state, without uncaught browser exceptions. The production build makes one extraction request and successfully reloads the complete article with networking disabled, after background relay data has populated the bounded cache.
- The development smoke test extracted Paul Graham's “How to Do Great Work” (over 67,000 characters of rendered text). `example.com` correctly reports no readable article; a loopback target is rejected.

## GitHub work reviewed

| Item | Status / next step |
| --- | --- |
| [#80: homepage articles are not pre-downloaded](https://github.com/dergigi/boris/issues/80) | Still open. This pass repairs offline reload and saved-article fallback; it does not proactively download every article linked by Explore highlights. |
| [#75: complete public X/Twitter threads](https://github.com/dergigi/boris/issues/75), [PR #76](https://github.com/dergigi/boris/pull/76) | Pending PR uses FxTwitter and retains Jina fallback. Rebase it onto the new reader interface and explicitly review that remaining third-party dependency before integration. |
| [PR #71: OpenGraph gateway fallback](https://github.com/dergigi/boris/pull/71) | Existing fix for share-preview metadata, separate from reader extraction. Reported mergeable with passing preview checks when inspected. Review and land separately. |
| [PR #78: Android source link](https://github.com/dergigi/boris/pull/78) | Documentation-only; still pending. |
| [#59: split oversized components](https://github.com/dergigi/boris/issues/59) | External loader is simplified here; broader component decomposition remains open. |
| [#55: Applesauce v5 casting](https://github.com/dergigi/boris/issues/55) | Optional architectural follow-up, not needed to repair extraction. |

## Remaining limitations and next priorities

1. Evaluate Brave Speedreader against a representative set of articles. Its Rust implementation combines site rules with a Readability-derived extractor; it is not a drop-in JavaScript package. The user chose Mozilla Readability for this pass. `lib/extractArticle.ts` isolates the engine from transport. See [Brave's architecture](https://github.com/brave/brave-core/blob/master/components/speedreader/rust/lib/README.md).
2. Test login, signer reconnects, bookmark writes, highlights, and zaps with a designated test account. This pass did not publish Nostr events or perform payment actions.
3. Implement intentional offline preloading (#80), with storage limits and user controls, then compare Android's reading/cache semantics in detail.
4. Audit the separate metadata/video services. Existing OpenGraph and video integrations still have third-party dependencies; removing Jina does not remove those.
5. Address the existing dependency audit backlog and large client bundle separately. A clean initial install reported 40 audit findings; no broad forced upgrades were applied in this repair pass.

Direct server fetching cannot extract content that requires browser JavaScript, login, a paywall, or passing a site challenge. These cases now have a visible failure and an original-page link. Serving only the static `dist` directory is insufficient: deploy the reader API alongside it, or use `npm run preview` locally.

## Release review decisions

The v0.12.4 review added immediate cancellation of active article relay queries, clearing the highlight spinner when the relay pool disappears, and support for schemeless hostnames with standard ports. The bounded relay deadline is intentional: removing it would restore indefinite waiting on relays that never send EOSE.

External article images/media still load directly in the browser, as before this release. Browser-side resource restrictions or a validated media proxy remain a separate hardening task; the server-side source fetch validates and pins its destination.
