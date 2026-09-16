## Favicon

**Priority:** P4
**Status:** open

### Problem

No page links an icon, so every tab shows the browser's placeholder. Reading
this site is walking a tree, and those pages are read side by side, so it is a
row of identical blank marks over titles that differ in their last segment.

### Proposal

Commit the two files. The site serves the repository directory itself
(`wrangler.jsonc`), so a file is served from where it sits and there is nothing
to generate; the mark will not change often, so a build step for it would buy
nothing either.

- **`favicon.ico` at the repository root**, because `/favicon.ico` is the path
  a browser asks for on its own, with no link to tell it otherwise. That one
  is fixed by the protocol.
- **`favicon.svg` in `fjs/website/`**, next to the generator that links it. It
  is reached only through that link, so its path is ours to choose, and the
  root keeps only the file it has to hold.

The generator's part is one
`['link', { rel: 'icon', href: '/fjs/website/favicon.svg' }]`, exported beside
`stylesheetLink` so no page spells the path, and taken by both heads — `page`
for a directory, and the root page's own frame.

Draw the mark as geometry rather than text: an SVG that names a font renders as
whatever the browser resolves it to. What the mark is, is the open question —
the site has no logo to inherit.

### Tasks

- [ ] Decide the mark.
- [ ] Commit `favicon.svg` in `fjs/website/` and `favicon.ico` at the root.
- [ ] Export the link and carry it in both heads.

### Related

- [green-link-colour](green-link-colour.md) — a colour of the site's own, which
  the mark would be the first use of.
- [Generate website](generate-website.md) — the umbrella list.
