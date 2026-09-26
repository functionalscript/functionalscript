## site-page-shell. Four page builders restate the site's head and URL layout

**Priority:** P4
**Status:** open

### Problem

`rootPage` in `fjs/website`, `page` in `fjs/website/page`, and
`releasePage` and `indexPage` in `fjs/website/changelog` each open with
the same head and header:

```js
htmlUtf8(lang)(
    ['title', …],
    stylesheetLink,
    ...faviconLinks,
)(
    header(build),
    ['main', …])
```

and `rootPage` and `page` both spell
`['main', { 'data-browser-tests': '', 'data-state': 'idle' }, …]`. The
site's layout is likewise written by hand wherever a page is named:
`pageHref` builds the href `/${path}/index.html`, the changelog `nav`
and `rootPage` both hard-code `/changelog/index.html`, and
`writeChangelog` builds the file it writes as
`${changelogDir}/index.html`. Adding a meta tag or moving the changelog
is four edits with nothing to catch a missed one.

### Proposal

`fjs/website/page` owns the shell and the layout:

```ts
export const sitePage: (build: Build) => (title: Nullable<string>) => (...main: readonly Node[]) => Vec
/** Where a directory's page is written, relative to the site root: `changelog/index.html`. */
export const pagePath: (path: string) => string
/** How a directory's page is linked, root-relative and URL-encoded: `/changelog/index.html`. */
export const pageHref: (path: string) => string
```

`pageHref` is already here; `pagePath` is its file-system twin, and the
two are kept distinct on purpose. An href is root-relative and
URL-encoded and a path to write is neither: `writeFile` of an href
would write at the file system's root and keep the percent escapes, so
`writeChangelog` writes `pagePath(changelogDir)` while the `nav` and
`rootPage` link `pageHref(changelogDir)`. The testable pages pass their
`main` attributes through one `testable` variant of `sitePage`.

### Tasks

- [ ] `sitePage` and `pagePath`; the four builders through `sitePage`.
- [ ] Every `index.html` literal through `pagePath` or `pageHref` as its
      use is a write or a link.
- [ ] `tsc`, `fjs test`; `npm run website` writes the same tree.

### Related

- [generate-website.md](./generate-website.md) — what the site generates;
  this is the shell every page shares.
