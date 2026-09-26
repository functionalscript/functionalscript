## site-page-shell. Four page builders restate the site's head and URL layout

**Priority:** P4
**Status:** open

### Problem

`rootPage` in `fjs/website`, `page` in `fjs/website/page`, and
`releasePage` and `indexPage` in `fjs/website/changelog` each open with
the same head:

```js
htmlUtf8(lang)(
    ['title', …],
    stylesheetLink,
    ...faviconLinks,
)(['main', …])
```

and `rootPage` and `page` both spell
`['main', { 'data-browser-tests': '', 'data-state': 'idle' }, …]`. The
site's URL layout is likewise written by hand wherever a link is made:
`pageHref` builds `/${path}/index.html`, the changelog `nav` and
`rootPage` both hard-code `/changelog/index.html`, and `writeChangelog`
builds its own `${changelogDir}/index.html`. Adding a meta tag or moving
the changelog is four edits with nothing to catch a missed one.

### Proposal

`fjs/website/page` owns the shell and the layout:

```ts
export const sitePage: (title: Nullable<string>) => (...main: readonly Node[]) => Vec
export const pageHref: (path: string) => string   // already here; the other sites use it
```

with the testable pages passing their `main` attributes through one
`testable` variant. The changelog `nav`, `rootPage` and `writeChangelog`
link through `pageHref`.

### Tasks

- [ ] `sitePage`; the four builders through it.
- [ ] Every `index.html` literal through `pageHref`.
- [ ] `tsc`, `fjs test`.

### Related

- [generate-website.md](./generate-website.md) — what the site generates;
  this is the shell every page shares.
