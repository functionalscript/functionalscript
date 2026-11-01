## Link previews for shared pages

**Priority:** P2
**Status:** open

### Problem

When someone pastes a link to a page of the site into Slack, Telegram, X,
Facebook, LinkedIn or Discord, the result is no preview, or just the bare
title. Those services build a preview card from Open Graph and Twitter
`<meta>` tags, and the site has none of them.

Every page the generator writes gets its `<head>` from `shell` in
[`../page/module.f.mjs`](../page/module.f.mjs). That function writes the
`<title>`, a referrer `<meta>`, the stylesheet, the favicons and the fragment
runtime, and nothing else.

The Rust API reference under `/cargo.doc/<crate>/` is the exception: `cargo
doc` writes those pages, and the site adds only one fixed fragment to each
`<head>`, `rustdocHead` in
[`../cargo-doc/module.f.mjs`](../cargo-doc/module.f.mjs), through
`--html-in-header`. Today that fragment is the favicon links alone.

Crawlers do not run JavaScript, but that is not a problem: every page is
complete HTML once the site is built, so tags added in `shell` will be in
what a crawler fetches.

### Ideas

- **The tags, in `shell`.** Adding them in one place covers the root page,
  directory pages and changelog pages together:

  ```html
  <meta name="description" content="…">
  <meta property="og:site_name" content="FunctionalScript">
  <meta property="og:type" content="website">
  <meta property="og:title" content="fjs/types · FunctionalScript">
  <meta property="og:description" content="…">
  <meta property="og:url" content="https://functionalscript.com/fjs/types/">
  <meta property="og:image" content="https://functionalscript.com/…/preview.png">
  <meta name="twitter:card" content="summary_large_image">
  ```

- **A description for each page.** `shell` takes only a title today, so it
  needs a description as well. The obvious source is the first paragraph of
  the directory's README with text (`dir.readme`, already rendered at build
  time). A paragraph of badges has none, since an image's text is in an
  attribute, so it is skipped: the root README opens with one. A directory
  without a README, and the root page, use one site-wide tagline.
- **The rustdoc pages.** `rustdocHead` is the same on every rustdoc page, so
  it can carry only the tags that do not vary by page: `og:site_name`,
  `og:type`, `twitter:card` and, where the build knows its origin,
  `og:image`. rustdoc writes each page's own `<title>` and
  `<meta name="description">`, which a card falls back to without
  `og:title` and `og:description`; `og:url` is left out.
- **Absolute URLs.** `og:url` and `og:image` must be absolute, and the build
  does not know its own domain: `Build` in
  [`../page/types.ts`](../page/types.ts) has `commit`, `branch` and `funding`
  only. There are two options:
  - Hard-code `https://functionalscript.com` as a constant next to
    `repository`. This is simple, but a preview deployment on
    `*.workers.dev` would then point its cards at production.
  - Add an `origin` field to `Build`, filled from the deploy environment.
    This is correct for previews too, and is the recommended option.
- **The image.** The site's only logo is
  [`../favicon.svg`](../favicon.svg). Most platforms (Facebook, X, LinkedIn,
  and often Slack) refuse SVG for `og:image`, so the site needs a raster
  image of about 1200×630, PNG or JPEG. One static image for the whole site
  is enough to start with. Per-page images can come later.
- **Proof.** Extend [`../proof.f.mjs`](../proof.f.mjs) to check that a page
  carries the tags with its own title, description and absolute URL.

### Verification

After deploying, check a few pages with a preview debugger, such as
opengraph.xyz or Facebook's Sharing Debugger. Platforms cache cards, so a
link shared before the change keeps its old preview for a while.
