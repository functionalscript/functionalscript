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

- **`favicon.ico` at the repository root**, which is the path anything that
  has not read one of our pages asks for on its own. The link below declares
  it too, and the root is still where it belongs.
- **`favicon.svg` in `fjs/website/`**, next to the generator that links it. It
  is reached only through that link, so its path is ours to choose, and the
  root keeps only the file it has to hold.

The generator's part is two links, exported beside `stylesheetLink` so no page
spells the paths, and taken by both heads — `page` for a directory, and the
root page's own frame:

```js
['link', { rel: 'icon', href: '/favicon.ico', sizes: '32x32' }]
['link', { rel: 'icon', type: 'image/svg+xml', href: '/fjs/website/favicon.svg' }]
```

**Both, because declaring one ends the implicit lookup.** `/favicon.ico` is
what a browser asks for when a document declares no icon at all; once a page
declares the SVG, a browser that recognizes `rel="icon"` but cannot render SVG
has no reason to go looking for the `.ico` — the fallback would never be
requested in the one case it exists for. So it is declared, and the `type`
tells a browser which link it can skip.

Draw the mark as geometry rather than text: an SVG that names a font renders as
whatever the browser resolves it to. What the mark is, is the open question —
the site has no logo to inherit.

### Tasks

- [ ] Decide the mark.
- [ ] Commit `favicon.svg` in `fjs/website/` and `favicon.ico` at the root.
- [ ] Export both links and carry them in both heads.

### Related

- [Generate website](generate-website.md) — the umbrella list; `--link` in
  `fjs/website/style/module.f.mjs` is the site's own colour, landed since this
  issue was filed.
