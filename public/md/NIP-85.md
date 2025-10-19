# NIP-85

## Reading Progress

`draft` `optional`

This NIP defines kind `39802`, a parameterized replaceable event for tracking reading progress across articles and web content.

## Table of Contents

* [Format](#format)
  * [Tags](#tags)
  * [Content](#content)
* [Examples](#examples)

## Format

Reading progress events use NIP-33 parameterized replaceable semantics. The `d` tag serves as the unique identifier per author and target content.

### Tags

Events SHOULD tag the source of the reading progress, whether nostr-native or not. `a` tags should be used for nostr events and `r` tags for URLs.

When tagging a URL, clients generating these events SHOULD do a best effort of cleaning the URL from trackers or obvious non-useful information from the query string.

- `d` (required): Unique identifier for the target content
  - For Nostr articles: `30023:<pubkey>:<identifier>` (matching the article's coordinate)
  - For external URLs: `url:<base64url-encoded-url>`
- `a` (optional but recommended for Nostr articles): Article coordinate `30023:<pubkey>:<identifier>`
- `r` (optional but recommended for URLs): Raw URL of the external content

### Content

The content is a JSON object with the following fields:

- `progress` (required): Number between 0 and 1 representing reading progress (0 = not started, 1 = completed)
- `loc` (optional): Number representing a location marker (e.g., pixel scroll position, page number, etc.)
- `ts` (optional): Unix timestamp (seconds) when the progress was recorded
- `ver` (optional): Schema version string

The latest event by `created_at` per (`pubkey`, `d`) pair is authoritative (NIP-33 semantics).

Clients SHOULD implement rate limiting to avoid excessive relay traffic (debounce writes, only save significant changes).

## Examples

### Nostr Article

```json
{
  "kind": 39802,
  "pubkey": "<user-pubkey>",
  "created_at": 1734635012,
  "content": "{\"progress\":0.66,\"loc\":1432,\"ts\":1734635012,\"ver\":\"1\"}",
  "tags": [
    ["d", "30023:<author-pubkey>:<article-identifier>"],
    ["a", "30023:<author-pubkey>:<article-identifier>"]
  ]
}
```

### External URL

```json
{
  "kind": 39802,
  "pubkey": "<user-pubkey>",
  "created_at": 1734635999,
  "content": "{\"progress\":1,\"ts\":1734635999,\"ver\":\"1\"}",
  "tags": [
    ["d", "url:aHR0cHM6Ly9leGFtcGxlLmNvbS9wb3N0"],
    ["r", "https://example.com/post"]
  ]
}
```
