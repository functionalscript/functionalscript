## Favicon

**Priority:** P4
**Status:** open

### Problem

No page links an icon, so a browser falls back to asking the site root for
`/favicon.ico`, which the repository does not have. Every tab shows the
browser's placeholder, and every page view spends a request on a file that is
not there.

The placeholder costs more here than it would on a one-page site. Reading this
site is walking a tree — a directory, its subdirectory, a proof's module — and
those pages are read side by side, so a row of tabs is a row of identical
blank marks whose titles are truncated paths that differ in their last
segment.

### Proposal

The icon is generated and linked exactly as the stylesheet is: written once by
the build beside `_main.css`, and carried in every head by an exported link, so
no page spells the path.

- **`fjs/website/style/module.f.mjs` exports a `faviconLink`** next to
  `stylesheetLink`, and both heads take it — `page` for a directory, and the
  root page's own frame in `fjs/website/module.f.mjs`. One page missing it is
  one tab that still shows the placeholder.
- **The build writes `_favicon.svg`** where it writes `_main.css`. The
  `_` prefix is what the tree already ignores and what the generator already
  keeps out of a directory's file list, so an icon needs no new rule in either
  place. The write is part of the same effect, and the proof drives it over the
  virtual tree the way the stylesheet's does.
- **Root-relative**, like every other link a page writes, because pages sit at
  every depth.

**Draw the mark as geometry, not as text.** An SVG naming a font renders with
whatever the browser resolves it to, and the mark is sixteen pixels of it; a
path is the same everywhere. The mark itself is the open question — the
project's initials and a terminal prompt are both obvious, and the site has no
logo to inherit.

**A raster fallback is a separate decision.** Not every browser takes an SVG
icon; one that does not falls back to the placeholder again. A PNG or `.ico`
would have to be a committed file rather than a generated one — `fjs/media/`
knows what an image's media type is and nothing there writes image bytes — so
it is the one piece of this that does not follow the stylesheet's pattern.

The tab's background is the browser's, not the site's, so the mark has to hold
up light and dark. An SVG can carry its own `prefers-color-scheme` rule, and
not every browser honours it in an icon; a mark that needs no such rule is
worth more than one that does.

### Tasks

- [ ] Decide the mark, and draw it as geometry.
- [ ] Export `faviconLink` and carry it in both heads.
- [ ] Write `_favicon.svg` in the build beside `_main.css`, proven over the
      virtual tree.
- [ ] Decide whether a raster fallback ships, and where it lives if it does.
- [ ] Check a tab in both colour schemes.

### Related

- [green-link-colour](green-link-colour.md) — a colour of the site's own, which
  the mark would be the first use of.
- [`../README.md`](../README.md) — why the stylesheet is written once and
  linked root-relative; the icon follows it.
- [Generate website](generate-website.md) — the umbrella list.
