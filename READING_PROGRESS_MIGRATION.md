# Reading Progress Migration Guide

## Overview

Boris has migrated from using NIP-78 application data (kind 30078) to a dedicated NIP-39802 Reading Progress event kind (kind 39802). This document outlines the migration strategy and timeline.

## Migration Phases

### Phase A: Dual-Write (Current Phase)
**Status:** Active  
**Timeline:** Initial release through Q1 2025

During this phase:
- ✅ Boris writes **both** kind 39802 (new) and kind 30078 (legacy) events
- ✅ Boris reads kind 39802 first, falls back to kind 30078 if not found
- ✅ Users can control migration via settings flags (internal):
  - `useReadingProgressKind`: Enable/disable kind 39802 reads (default: true)
  - `writeLegacyReadingPosition`: Enable/disable kind 30078 writes (default: true)

**Benefits:**
- Backward compatibility with older Boris versions
- Cross-client compatibility during transition
- Safe rollback path if issues are discovered

### Phase B: Prefer New Kind (Planned)
**Status:** Planned  
**Timeline:** Q2 2025

During this phase:
- Boris will default to writing only kind 39802
- Legacy writes (kind 30078) will be disabled by default but available via setting
- Reading will continue to support both kinds for backward compatibility

**Migration trigger:**
- Set `writeLegacyReadingPosition: false` in user settings
- Or wait for automatic transition in a future release

### Phase C: Legacy Deprecation (Future)
**Status:** Future  
**Timeline:** Q3 2025+

During this phase:
- Boris will stop writing kind 30078 entirely
- Reading will still support kind 30078 for historical data
- Documentation will recommend other clients adopt NIP-39802

## Technical Details

### Event Structure Comparison

#### Legacy (kind 30078)
```json
{
  "kind": 30078,
  "content": "{\"position\":0.66,\"timestamp\":1734635012,\"scrollTop\":1432}",
  "tags": [
    ["d", "boris:reading-position:<base64url-identifier>"],
    ["client", "boris"]
  ]
}
```

#### New (kind 39802)
```json
{
  "kind": 39802,
  "content": "{\"progress\":0.66,\"ts\":1734635012,\"loc\":1432,\"ver\":\"1\"}",
  "tags": [
    ["d", "30023:<pubkey>:<identifier>"],
    ["a", "30023:<pubkey>:<identifier>"],
    ["client", "boris"]
  ]
}
```

### Key Differences

1. **d tag format:**
   - Legacy: `boris:reading-position:<identifier>`
   - New: Article coordinate or `url:<base64url>` for URLs

2. **Timestamp authority:**
   - Legacy: Uses `content.timestamp` for ordering
   - New: Uses `event.created_at` for ordering (per NIP-33 spec)

3. **Content schema:**
   - Legacy: `{position, timestamp, scrollTop}`
   - New: `{progress, ts, loc, ver}`

4. **Discoverability:**
   - Legacy: Requires knowledge of `boris:reading-position:` prefix
   - New: Standard kind with `a` and `r` tags for filtering

## Testing Checklist

Before disabling legacy writes, verify:

- [ ] Reading progress syncs correctly for Nostr articles (kind 30023)
- [ ] Reading progress syncs correctly for external URLs
- [ ] Progress restores correctly on article reload
- [ ] Progress merges correctly when reading from multiple devices
- [ ] Newer timestamps take precedence (created_at ordering)
- [ ] Legacy kind 30078 events are still readable
- [ ] Migration works across relay sets
- [ ] Local-first loading works (event store cache)
- [ ] Background relay sync works correctly

## For Other Client Developers

If you're implementing reading progress in your Nostr client:

1. **Adopt NIP-39802** for new implementations
2. **Read both kinds** during transition (prefer 39802, fall back to 30078)
3. **Use `created_at`** for event ordering, not content timestamps
4. **Implement rate limiting** to avoid relay spam (debounce, min delta)
5. See full spec at `/public/md/NIP-39802.md`

## Rollback Plan

If critical issues are discovered with kind 39802:

1. Set `useReadingProgressKind: false` in settings
2. Boris will fall back to kind 30078 only
3. Report issues on GitHub
4. Wait for fix before re-enabling

## Settings API

Users can control migration behavior via settings:

```typescript
interface UserSettings {
  // ... other settings
  syncReadingPosition?: boolean // Master toggle (default: false)
  useReadingProgressKind?: boolean // Use kind 39802 (default: true)
  writeLegacyReadingPosition?: boolean // Write kind 30078 (default: true)
}
```

## Timeline Summary

| Phase | Start | End | Kind 39802 Write | Kind 30078 Write | Kind 30078 Read |
|-------|-------|-----|------------------|------------------|-----------------|
| A: Dual-Write | Now | Q1 2025 | ✅ Yes | ✅ Yes | ✅ Yes |
| B: Prefer New | Q2 2025 | Q3 2025 | ✅ Yes | ⚠️ Optional | ✅ Yes |
| C: Deprecate | Q3 2025+ | - | ✅ Yes | ❌ No | ✅ Yes (historical) |

## Questions?

- See NIP-39802 spec: `/public/md/NIP-39802.md`
- File issues on GitHub
- Discuss in Nostr developer channels

