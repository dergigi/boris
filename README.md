# Boris

Your reading list for the Nostr world.

Boris turns your Nostr bookmarks into a calm, fast, and focused reading experience. Connect your Nostr account and you'll get a clean three‑pane reader: bookmarks on the left, the article in the middle, and highlights on the right.

## Live

- App: [https://read.withboris.com/](https://read.withboris.com/)

## The Vision

When I wrote "Purple Text, Orange Highlights" 2.5 years ago, I had a certain interface in mind that would allow the reader to curate, discover, highlight, and provide value to writers and other readers alike. Boris is my attempt to build this interface.

Boris has three "levels" of highlights for each article:

- user = yellow
- friends = orange
- nostrverse = purple

In case it's not self-explanatory:

- **your highlights** = highlights that the logged-in npub made
- **friends** = highlights that your friends made, i.e. highlights of the npubs that the logged-in user follows
- **nostrverse** = all the highlights we can find on all the relays we're connected to

The user can toggle hide/show any of these "levels".

In addition to rendering articles from nostr and the legacy web, Boris can act as a "read it later" app, thanks to the power of nostr bookmarks.

If you bookmark something on nostr, Boris will show it in the bookmarks bar. If said something contains a URL, Boris will extract and render it in a distraction-free and reader-friendly way.

## What Boris does

- Collects your saved links from Nostr and shows them as a tidy reading list
- Opens articles in a distraction‑free reader with clear typography
- Shows community highlights layered on the article (yours, friends, everyone)
- Splits zaps between you and the author(s) when you highlight
- Lets you collapse sidebars anytime for full‑focus reading
- Remembers simple preferences like view mode, fonts, and highlight style

## How it works

1. Connect your Nostr account.
   - Click “Connect” and approve with your usual Nostr signer.
2. Browse your bookmarks.
   - Your lists and items appear on the left. Pick anything to read.
3. Read in comfort.
   - The center panel renders a readable article view with images and headings.
4. See what people highlighted.
   - The right panel shows highlights by level:
     - Mine (your highlights)
     - Friends (people you follow)
     - Nostrverse (everyone else)
   - Each level has its own color. Click any highlight to jump to that spot.
5. Focus when you want.
   - Collapse one or both side panels. The layout adapts without wasting space.

## Why people like Boris

- No noise: Just your saved links and the best excerpts others found
- Fast by default: Opens instantly in your browser
- Portable: Works with any Nostr account; your data travels with you
- Designed for reading: Smooth navigation and instant scroll‑to‑highlight

## Tips

- Hover icons and counters to see what they do — most controls are discoverable.
- Lots of highlights? Scan the right panel and click to jump between them.
- Open Settings to switch fonts, tweak highlight styles, and change the list view.

## Privacy and data

- Boris doesn’t ask for an email or create a new account — it connects to your existing Nostr identity.
- Your bookmarks and highlights live on Nostr. Boris reads from the network and renders everything locally in your browser.

## Troubleshooting

- If something looks empty, try opening another article and coming back — network data can arrive in bursts.
- Not every article has highlights yet; they grow as the community reads.

## Development

### Testing Open Graph Previews

To manually test the Open Graph HTML preview for an article, append `?og=1` to any `/a/:naddr` URL:

```text
https://read.withboris.com/a/<naddr>?og=1
```

This bypasses the normal SPA routing and serves the OG preview HTML directly, useful for verifying social media preview cards.

## License

MIT
