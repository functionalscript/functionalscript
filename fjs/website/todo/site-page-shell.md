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
/** Where a directory's page is written: `changelog/index.html`. */
export const pagePath: (path: string) => string
/** How it is linked, root-relative and URL-encoded: `/changelog/index.html`. */
export const pageHref: (path: string) => string
```

`pageHref` is already here; `pagePath` is its file-system twin, kept
distinct because an href is root-relative and URL-encoded and a path to
write is neither. `writeChangelog` writes through `pagePath`; the links
go through `pageHref`.

One shell builder for the four pages, with the head and the header
written once. Its exact shape is the implementer's call, with one
requirement: the root page and the module page keep the `main`
attributes the browser-test runtime looks for, and the changelog pages
keep a plain `main`.

### Tasks

- [ ] The shell builder and `pagePath`; the four builders through them.
- [ ] Every `index.html` literal through `pagePath` or `pageHref` as its
      use is a write or a link.
- [ ] `tsc`, `fjs test`; `npm run website` writes the same tree.

### Related

- [generate-website.md](./generate-website.md) — what the site generates;
  this is the shell every page shares.
