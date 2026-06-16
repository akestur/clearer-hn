# Clearer HN

Small, safe visual refinements that make [Hacker News](https://news.ycombinator.com) easier to read — **without changing how the site works.**

Nothing moves. Same ranked list, the same upvote arrows in the same place, the same links, scores, and "More" pagination. There's no layout overhaul and nothing to relearn — it just reads cleaner. Uninstall and you're back to plain HN instantly.

If you've been burned by a radical Hacker News redesign before, this is the opposite of that: it restyles the page in place (so voting, login, and replies are untouched), the changes are mostly visual — contrast, spacing, density, legibility — and the few functional extras are opt-in. It's built for everyone, newcomers and power users who want HN to stay dense and fast.

> **Not affiliated with Y Combinator or Hacker News.** "Hacker News" is a trademark of Y Combinator. Clearer HN is an independent, unofficial extension that restyles the site in your browser.

## Demo

https://github.com/user-attachments/assets/d7d1fdb5-378e-4fb8-8a77-027233f1da34

## What it does

- **A more legible feed.** Quiet metadata, clearer separators, and a little more spacing between rows. That extra breathing room means you'll see a few fewer stories per screen than default HN — a deliberate trade for easier reading, not a compaction.
- **20 items per page.** With the roomier rows, list pages are capped at 20 so a page stays about as tall as default HN's. Prev/Next paging updates the URL (`?cp=N`), so Back, Forward, and bookmarks behave like normal pages — and it fetches Hacker News's own pages behind the scenes, so nothing is skipped (HN's native paging jumps in 30s). Toggleable.
- **Better readability.** Higher-contrast metadata text and comfortable line spacing in the comment view, without sacrificing HN's density on the feed.
- **A slim, tidy header** in place of HN's pipe-delimited bar, with the same links.
- **Comment tools (opt-in):** collapse-all / expand-all / jump-to-next-new, an **OP** tag, markers for comments posted since your last visit, subtle depth guides on nested replies, and `j` / `k` / `z` keyboard navigation. The toolbar stays in view while you scroll a thread.
- **Read / new-comment tracking.** Stories you've opened dim so your eye skips them, and stories with new comments since your last visit show a "+N" badge — something HN itself doesn't offer.
- **A replies view** — a "Replies to me" filter on the `threads` page.
- **Submit-page hints** — live title length, Show/Ask/Tell/Launch prefix detection, and a duplicate-URL check via HN's own search.
- **Light / dark / auto** theme switcher in the header.

Every feature can be turned off from the toolbar popup.

## Install

### From the Chrome Web Store

_Link coming soon._ <!-- TODO: add Web Store URL after publishing -->

### From source (developer mode)

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked** and select the project folder.
5. Visit https://news.ycombinator.com.

## Privacy

Clearer HN has no backend and no analytics. Your settings and read/new-comment
tracking are stored **locally** on your device. The only outbound request is an
optional duplicate-URL check on the submit page, sent to Hacker News's own
public search API. It requests a single permission, `storage`, and runs only on
`news.ycombinator.com`.

See [PRIVACY.md](PRIVACY.md) for the full policy.

## How it stays safe

- **No DOM teardown.** The extension styles HN's existing elements and only
  *adds* small helper nodes (a toolbar, tags, hints). It never removes or
  re-creates HN's voting / reply controls.
- **Minimal permissions.** Only `storage`. No host permissions, no background
  access to your browsing, no remote scripts, fonts, or images.
- **Graceful degradation.** Every enhancement is wrapped so that if HN changes
  its markup, the worst case is a feature quietly not appearing — the
  underlying site keeps working.

## Project layout

```
manifest.json        Manifest V3 config (content script on news.ycombinator.com/*)
content/theme.css    Global base: tokens, injected components, dark mode, read/new tracking
content/clean.css    Modern base layer (spacing, recolored rows, form controls)
content/style.css    The shipped style: slim header, compact feed, comment polish
content/enhance.js   Page detection, header, comment tools, read/new tracking, inbox, submit hints
popup/               Settings popup
icons/               Toolbar / store icons
test/phn_test.js     jsdom smoke tests for the content-script behavior
```

## Development

```bash
npm install      # installs jsdom (test-only dependency)
npm test         # runs the jsdom smoke tests
npm run build    # packages an extension-only zip into dist/
```

The tests run the content script against faithful Hacker News DOM fixtures in
[jsdom](https://github.com/jsdom/jsdom) and assert the behavior. jsdom has no
rendering engine, so purely visual CSS is verified by hand in the browser.

## Contributing

Issues and pull requests are welcome. Please keep the core principle in mind:
**restyle in place, never break HN's interaction model.** If a change would move
the upvote arrow, alter voting, or hide information HN regulars rely on, it
probably belongs behind a toggle.

## License

[MIT](LICENSE) © 2026 Akhil Kestur
