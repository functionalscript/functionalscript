## A card image per page

**Priority:** P3
**Status:** wip

### Problem

Every page's link preview shows the same image, the committed
[`preview.png`](../preview.png): the logo and the site's name
([the website README](../README.md#a-shared-link-shows-a-card)). A link to a
directory says nothing in the card about what that directory holds, though
its page opens with exactly that: its README.

### Proposal

A page with a rendered README gets a card image of it: the README as the
page shows it, without the header, the catalogue, the breadcrumb or the
footer. Every other page gets the root page's card, which replaces the
committed `preview.png`.

- **Rendered by a browser, at build time.** Only a browser lays out the
  site's own CSS, so the card is a screenshot and cannot drift from the page.
  The generator writes a card page beside each page; a step after it, in CI,
  screenshots each with headless Chromium, driven over the DevTools protocol
  with Node's built-in `WebSocket`, so no npm dependency is added. A local
  build writes the card pages but no images, as it writes no `og:image`.
- **1200×630 at 1×, light.** The size large cards show uncropped; a card
  cannot follow the viewer's dark mode.
- **The whole README, faded at the bottom.** The card never stops at a
  heading: a README whose intro is one line, or none, would leave an empty
  card. Content longer than the card fades into the background over its last
  140px instead of being cut mid-line.
- **Trimmed.** 40px above the first heading and 48px on each side; the
  README's reading width does not apply, so the margins are even.
- **No controls.** Permalinks and buttons are hidden.
- **An image from another site gets five seconds.** One that has not loaded
  by then, or fails, is removed before the screenshot, so a slow badge server
  costs the card its badge and never draws a broken image.
- **Alt text is the page's title**, not the logo's description.

### Tasks

- [ ] The card page: a self-contained page per README, its path, and the
      card image every page's `og:image` names.
- [ ] The screenshot step, and its place in the website workflow.
- [ ] Remove the committed `preview.png`, move these decisions to the website
      README, and delete this file.

### Related

- [rustdoc-page-cards.md](./rustdoc-page-cards.md) — rustdoc's pages share
  one `<head>` fragment, so they keep the root page's card.
