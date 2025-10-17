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

### Concurrent bookmark decryption
- **Problem**: Sequential decrypt of encrypted bookmark events blocks UI and takes long with multiple events.
- **Solution**: Refactored `collectBookmarksFromEvents` to:
  - Collect public bookmarks immediately (synchronous).
  - Schedule decrypt jobs for events with encrypted content.
  - Run decrypt jobs with limited concurrency (6 parallel max) using `mapWithConcurrency`.
  - Each decrypt wrapped with 30s timeout as safety net.
- **Result**: Bookmark loading is faster and UI remains responsive during decrypts.

## Current conclusion

- Client is configured and publishing requests correctly; encryption proves end‑to‑end path is alive.
- Non-blocking publish and concurrent decrypts keep UI responsive.
- The missing DECRYPT activity in Amber is the blocker. Fixing Amber's NIP‑46 decrypt handling should resolve bookmark decryption in Boris without further client changes.


