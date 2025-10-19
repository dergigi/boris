# NIP-85

## Reading Progress

`draft` `optional`

This NIP defines kind `39802`, a parameterized replaceable event for tracking reading progress across articles and web content.

## Table of Contents

* [Event Kind](#event-kind)
* [Event Structure](#event-structure)
  * [Tags](#tags)
  * [Content](#content)
  * [Semantics](#semantics)
* [Examples](#examples)
* [Querying](#querying)
* [Privacy Considerations](#privacy-considerations)
* [Rationale](#rationale)
* [Implementation Notes](#implementation-notes)

## Event Kind

- `39802`: Reading Progress (Parameterized Replaceable)

## Event Structure

Reading progress events use NIP-33 parameterized replaceable semantics. The `d` tag serves as the unique identifier per author and target content.

### Tags

- `d` (required): Unique identifier for the target content
  - For Nostr articles: `30023:<pubkey>:<identifier>` (matching the article's coordinate)
  - For external URLs: `url:<base64url-encoded-url>`
- `a` (optional but recommended for Nostr articles): Article coordinate `30023:<pubkey>:<identifier>`
- `r` (optional but recommended for URLs): Raw URL of the external content
  - Clients SHOULD clean URLs from tracking parameters and non-essential query strings before tagging
- `client` (optional): Client application identifier

### Content

The content is a JSON object with the following fields:

- `progress` (required): Number between 0 and 1 representing reading progress (0 = not started, 1 = completed)
- `loc` (optional): Number representing a location marker (e.g., pixel scroll position, page number, etc.)
- `ts` (optional): Unix timestamp (seconds) when the progress was recorded. This is for display purposes only; event ordering MUST use `created_at`
- `ver` (optional): Schema version string (e.g., "1")

### Semantics

- The latest event by `created_at` per (`pubkey`, `d`) pair is authoritative (NIP-33 semantics)
- Clients SHOULD implement rate limiting to avoid excessive relay traffic:
  - Debounce writes (recommended: 5 seconds)
  - Only save when progress changes significantly (recommended: ≥1% delta)
  - Skip saving very early progress (recommended: <5%)
  - Always save on completion (progress = 1) and when unmounting/closing content
- The `created_at` timestamp SHOULD match the time the progress was observed
- Event ordering and replaceability MUST use `created_at`, not the optional `ts` field in content

## Examples

### Nostr Article Progress

```json
{
  "kind": 39802,
  "pubkey": "<user-pubkey>",
  "created_at": 1734635012,
  "content": "{\"progress\":0.66,\"loc\":1432,\"ts\":1734635012,\"ver\":\"1\"}",
  "tags": [
    ["d", "30023:<author-pubkey>:<article-identifier>"],
    ["a", "30023:<author-pubkey>:<article-identifier>"],
    ["client", "boris"]
  ],
  "id": "<event-id>",
  "sig": "<signature>"
}
```

### External URL Progress

```json
{
  "kind": 39802,
  "pubkey": "<user-pubkey>",
  "created_at": 1734635999,
  "content": "{\"progress\":1,\"ts\":1734635999,\"ver\":\"1\"}",
  "tags": [
    ["d", "url:aHR0cHM6Ly9leGFtcGxlLmNvbS9wb3N0"],
    ["r", "https://example.com/post"],
    ["client", "boris"]
  ],
  "id": "<event-id>",
  "sig": "<signature>"
}
```

## Querying

### All progress for a user

```json
{
  "kinds": [39802],
  "authors": ["<user-pubkey>"]
}
```

### Progress for a specific Nostr article

```json
{
  "kinds": [39802],
  "authors": ["<user-pubkey>"],
  "#d": ["30023:<author-pubkey>:<article-identifier>"]
}
```

Or using the `a` tag:

```json
{
  "kinds": [39802],
  "authors": ["<user-pubkey>"],
  "#a": ["30023:<author-pubkey>:<article-identifier>"]
}
```

### Progress for a specific URL

```json
{
  "kinds": [39802],
  "authors": ["<user-pubkey>"],
  "#r": ["https://example.com/post"]
}
```

## Privacy Considerations

Reading progress events are public by default to enable interoperability between clients. Users concerned about privacy should:

- Use clients that allow disabling progress sync
- Use clients that allow selective relay publishing
- Be aware that reading progress reveals their reading habits

A future extension could define an encrypted variant for private progress tracking, but that is out of scope for this NIP.

## Rationale

### Why a dedicated kind instead of NIP-78 application data?

While NIP-78 (kind 30078) can store arbitrary application data, a dedicated kind offers several advantages:

1. **Discoverability**: Other clients can easily find and display reading progress without knowing application-specific `d` tag conventions
2. **Interoperability**: Standard schema enables cross-client compatibility
3. **Indexing**: Relays can efficiently index and query reading progress separately from other app data
4. **Semantics**: Clear, well-defined meaning for the event kind

### Why parameterized replaceable (NIP-33)?

- Each article/URL needs exactly one current progress value per user
- Automatic deduplication by relays reduces storage and bandwidth
- Simple last-write-wins semantics based on `created_at`
- Efficient querying by `d` tag

### Why include both `d` and `a`/`r` tags?

- `d` provides the unique key for replaceability
- `a` and `r` enable efficient filtering without parsing `d` values
- Redundancy improves relay compatibility and query flexibility

## Implementation Notes

- Clients SHOULD use the event's `created_at` as the authoritative timestamp for sorting and merging progress
- The optional `ts` field in content is for display purposes only (e.g., "Last read 2 hours ago")
- For URLs, the base64url encoding in the `d` tag MUST use URL-safe characters (replace `+` with `-`, `/` with `_`, remove padding `=`)
- Clients SHOULD validate that `progress` is between 0 and 1

### URL Handling

When generating events for external URLs:

- Clients SHOULD clean URLs by removing tracking parameters (e.g., `utm_*`, `fbclid`, etc.) and other non-essential query strings
- The cleaned URL should be used for both the `r` tag and the base64url encoding in the `d` tag
- This ensures that the same article from different sources (with different tracking params) maps to the same reading progress event

## References

- [NIP-01: Basic protocol flow](https://github.com/nostr-protocol/nips/blob/master/01.md)
- [NIP-33: Parameterized Replaceable Events](https://github.com/nostr-protocol/nips/blob/master/33.md)

