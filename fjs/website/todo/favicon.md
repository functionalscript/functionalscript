## Favicon

**Priority:** P4
**Status:** open

### Problem

No page links an icon, so every tab shows the browser's placeholder. Reading
this site is walking a tree, and those pages are read side by side, so it is a
row of identical blank marks over titles that differ in their last segment.

### Proposal

Commit `favicon.svg` and `favicon.ico` at the repository root. The site serves
the repository directory itself (`wrangler.jsonc`), so both are served from `/`
with nothing to generate, and `/favicon.ico` is the path a browser asks for on
its own. The mark is not derived from anything in the tree and will not change
often, so a build step for it would buy nothing.

The generator's part is one `['link', { rel: 'icon', href: '/favicon.svg' }]`,
exported beside `stylesheetLink` so no page spells the path, and taken by both
heads — `page` for a directory, and the root page's own frame.

Draw the mark as geometry rather than text: an SVG that names a font renders as
whatever the browser resolves it to. What the mark is, is the open question —
the site has no logo to inherit.

### Tasks

- [ ] Decide the mark.
- [ ] Commit `favicon.svg` and `favicon.ico` at the root.
- [ ] Export the link and carry it in both heads.

### Related

- [green-link-colour](green-link-colour.md) — a colour of the site's own, which
  the mark would be the first use of.
- [Generate website](generate-website.md) — the umbrella list.
