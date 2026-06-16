# Privacy Policy — Clearer HN

_Last updated: June 16, 2026_

Clearer HN is built to be private by default. It does not have a backend, does not run analytics, and does not collect, sell, or transmit your personal information.

## What it stores

All of the following is stored **locally on your device** using the browser's
extension storage (`chrome.storage.local`). None of it leaves your computer.

- **Your settings** — theme choice and which features are enabled.
- **Read / new-comment tracking** — for threads you open, the extension records
  the time of your visit and how many comments existed, so it can dim stories
  you've seen and show a "+N new comments" badge. This is a list of Hacker News
  item IDs with timestamps and counts, capped to your most recent ~500 threads.

You can clear all of it at any time by removing the extension, or from
`chrome://extensions` → Clearer HN → "Clear data".

## Network requests

Clearer HN makes **one** type of outbound request, and only in one place:

- **Submit-page duplicate check.** When you type a URL on the Hacker News
  submit page, the extension queries Hacker News's official public search API
  (`hn.algolia.com`) to tell you whether that URL has been submitted before.
  Only the URL you're submitting is sent, and only to that API. You can turn
  this off with the "Submit hints" toggle in the popup.

- **Loading more list items.** With "20 per page" enabled, clicking "More"
  fetches the next page directly from Hacker News (`news.ycombinator.com`) — the
  same request your browser would make if you navigated there — and shows the
  next 20 items in place. It's the site you're already on; no third party is
  involved.

The extension does not contact any server operated by the author. It does not
load remote scripts, fonts, or images.

## Permissions

Clearer HN requests a single permission:

- `storage` — to save your settings and read/new-comment tracking locally.

It runs only on `news.ycombinator.com`. It has no access to your other tabs,
your browsing history, or any other site.

## Changes

If this policy changes, the updated version will be published in this file in
the project's GitHub repository.

## Contact

Questions or concerns: open an issue on the GitHub repository.
