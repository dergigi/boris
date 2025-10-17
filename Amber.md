## Boris ↔ Amber bunker: current findings

- **Environment**
  - Client: Boris (web) using `applesauce` stack (`NostrConnectSigner`, `RelayPool`).
  - Bunker: Amber (mobile).
  - We restored a `nostr-connect` account from localStorage and re-wired the signer to the app `RelayPool` before use.

## What we changed client-side

- **Signer wiring**
  - Bound `NostrConnectSigner.subscriptionMethod/publishMethod` to the app `RelayPool` at startup.
  - After deserialization, recreated the signer with pool context and merged its relays with app `RELAYS` (includes local relays).
  - Opened the signer subscription and performed a guarded `connect()` with default permissions including `nip04_encrypt/decrypt` and `nip44_encrypt/decrypt`.

- **Account queue disabling (CRITICAL)**
  - `applesauce-accounts` `BaseAccount` queues requests by default - each request waits for the previous one to complete before being sent.
  - This caused batch decrypt operations to hang: first request would timeout waiting for user interaction, blocking all subsequent requests in the queue.
  - **Solution**: Set `accounts.disableQueue = true` globally on the `AccountManager` in `App.tsx` during initialization. This applies to all accounts.
  - Without this, Amber never sees decrypt requests because they're stuck in the account's internal queue.
  - Reference: https://hzrd149.github.io/applesauce/typedoc/classes/applesauce-accounts.BaseAccount.html#disablequeue

- **Probes and timeouts**
  - Initial probe tried `decrypt('invalid-ciphertext')` → timed out.
  - Switched to roundtrip probes: `encrypt(self, ... )` then `decrypt(self, cipher)` for both nip-44 and nip-04.
  - Increased probe timeout from 3s → 10s; increased bookmark decrypt timeout from 15s → 30s.

- **Logging**
  - Added logs for publish/subscribe and parsed the NIP-46 request content length.
  - Confirmed NIP‑46 request events are kind `24133` with a single `p` tag (expected). The method is inside the encrypted content, so it prints as `method: undefined` (expected).

## Evidence from logs (client)

```
[bunker] ✅ Wired NostrConnectSigner to RelayPool publish/subscription
[bunker] 🔗 Signer relays merged with app RELAYS: (19) [...]
[bunker] subscribe via signer: { relays: [...], filters: [...] }
[bunker] ✅ Signer subscription opened
[bunker] publish via signer: { relays: [...], kind: 24133, tags: [['p', <remote>]], contentLength: 260|304|54704 }
[bunker] 🔎 Probe nip44 roundtrip (encrypt→decrypt)… → probe timeout after 10000ms
[bunker] 🔎 Probe nip04 roundtrip (encrypt→decrypt)… → probe timeout after 10000ms
bookmarkProcessing.ts: ❌ nip44.decrypt failed: Decrypt timeout after 30000ms
bookmarkProcessing.ts: ❌ nip04.decrypt failed: Decrypt timeout after 30000ms
```

Notes:
- Final signer status shows `listening: true`, `isConnected: true`, and requests are published to 19 relays (includes Amber’s).

## Evidence from Amber (device)

- Activity screen shows multiple entries for: “Encrypt data using nip 4” and “Encrypt data using nip 44” with green checkmarks.
- No entries for “Decrypt data using nip 4” or “Decrypt data using nip 44”.

## Interpretation

- Transport and publish paths are working: Boris is publishing NIP‑46 requests (kind 24133) and Amber receives them (ENCRYPT activity visible).
- The persistent failure is specific to DECRYPT handling: Amber does not show any DECRYPT activity and Boris receives no decrypt responses within 10–30s windows.
- Client-side wiring is likely correct (subscription open, permissions requested, relays merged). The remaining issue appears provider-side in Amber’s NIP‑46 decrypt handling or permission gating.

## Repro steps (quick)

1) Revoke Boris in Amber.
2) Reconnect with a fresh bunker URI; approve signing and both encrypt/decrypt scopes for nip‑04 and nip‑44.
3) Keep Amber unlocked and foregrounded.
4) Reload Boris; observe:
   - Logs showing `publish via signer` for kind 24133.
   - In Amber, activity should include “Decrypt data using nip 4/44”.

If DECRYPT entries still don’t appear:

- This points to Amber’s NIP‑46 provider not executing/authorizing `nip04_decrypt`/`nip44_decrypt` methods, or not publishing responses.

## Suggestions for Amber-side debugging

- Verify permission gating allows `nip04_decrypt` and `nip44_decrypt` (not just encrypt).
- Confirm the provider recognizes NIP‑46 methods `nip04_decrypt` and `nip44_decrypt` in the decrypted payload and routes them to decrypt routines.
- Ensure the response event is published back to the same relays and correctly addressed to the client (`p` tag set and content encrypted back to client pubkey).
- Add activity logging for “Decrypt …” attempts and failures to surface denial/exception states.

## Performance improvements (post-debugging)

### Non-blocking publish wiring
- **Problem**: Awaiting `pool.publish()` completion blocks until all relay sends finish (can take 30s+ with timeouts).
- **Solution**: Wrapped `NostrConnectSigner.publishMethod` at app startup to fire-and-forget publish Observable/Promise; responses still arrive via signer subscription.
- **Result**: Encrypt/decrypt operations complete in <2s as seen in `/debug` page (NIP-44: ~900ms enc, ~700ms dec; NIP-04: ~1s enc, ~2s dec).

### Bookmark decryption optimization
- **Problem #1**: Sequential decrypt of encrypted bookmark events blocks UI and takes long with multiple events.
- **Problem #2**: 30-second timeouts on `nip44.decrypt` meant waiting 30s per event if bunker didn't support nip44.
- **Problem #3**: Account request queue blocked all decrypt requests until first one completed (waiting for user interaction).
- **Solution**: 
  - Removed all artificial timeouts - let decrypt fail naturally like debug page does.
  - Added smart encryption detection (NIP-04 has `?iv=`, NIP-44 doesn't) to try the right method first.
  - **Disabled account queue globally** (`accounts.disableQueue = true`) in `App.tsx` so all requests are sent immediately.
  - Process sequentially (removed concurrent `mapWithConcurrency` hack).
- **Result**: Bookmark decryption is near-instant, limited only by bunker response time and user approval speed.

## Amethyst-style bookmarks (kind:30001)

**Important**: Bookmark events (kind:30001) that have public `tags` and private `content` are **Amethyst-style bookmarks**.

### Format:
- **Public bookmarks**: Stored in event `tags` (e.g., `["e", "..."]`, `["a", "..."]`)
- **Private bookmarks**: Stored in encrypted `content` field (NIP-04 or NIP-44)

### Implementation details:
- The encrypted `content` field contains a JSON array of private bookmark tags
- `Helpers.hasHiddenContent()` from `applesauce-core` only detects **NIP-44** encrypted content
- **NIP-04** encrypted content must be detected explicitly by checking for `?iv=` in the content string
- Both detection methods are needed in:
  1. **Display logic** (`Debug.tsx` - `hasEncryptedContent()`) - to show padlock emoji and decrypt button
  2. **Decryption logic** (`bookmarkProcessing.ts`) - to schedule decrypt jobs

### Example event structure:
```json
{
  "kind": 30001,
  "tags": [
    ["d", "bookmark"],
    ["e", "102a2fe..."],  // Public bookmark
    ["e", "84ce035..."]   // Public bookmark
  ],
  "content": "lvOfl7Qb...?iv=5KzDXv09..."  // NIP-04 encrypted private bookmarks
}
```

### Why this matters:
This dual-storage format (public + private) is why we need explicit NIP-04 detection. Without it, `Helpers.hasHiddenContent()` returns `false` and the encrypted content is never decrypted, resulting in 0 private bookmarks despite having encrypted data.

## Current conclusion

- Client is configured and publishing requests correctly; encryption proves end‑to‑end path is alive.
- Non-blocking publish keeps operations fast (~1-2s for encrypt/decrypt).
- **Account queue is GLOBALLY DISABLED** - this was the primary cause of hangs/timeouts.
- Smart encryption detection (both NIP-04 and NIP-44) and no artificial timeouts make operations instant.
- Sequential processing is cleaner and more predictable than concurrent hacks.
- Relay queries now trust EOSE signals instead of arbitrary timeouts, completing in 1-2s instead of 6s.
- The missing DECRYPT activity in Amber was partially due to requests never being sent (stuck in queue). With queue disabled globally, Amber receives all decrypt requests immediately.
- **Amethyst-style bookmarks** require explicit NIP-04 detection (`?iv=` check) since `Helpers.hasHiddenContent()` only detects NIP-44.


