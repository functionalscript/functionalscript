## Per-page card tags on rustdoc pages

**Priority:** P3
**Status:** open

### Problem

The Rust API reference under `/cargo.doc/<crate>/` lacks `og:title`, which
the [Open Graph protocol](https://ogp.me/) requires on every page. `cargo doc`
writes those pages, and the site adds only one fixed fragment to each
`<head>`, `rustdocHead` in [`../cargo-doc/module.f.mjs`](../cargo-doc/module.f.mjs),
through `--html-in-header`. It ends with a marker, `pageMetaMarker`, which
`withPageMeta` replaces with the page's card tags as the generator copies it
([the website README](../README.md#a-shared-link-shows-a-card)): its
`og:url`, from its path, and its crate's card. The title cannot be had the
same way, because the copy does not know it: it is in rustdoc's `<title>`.

Slack, Discord, Telegram, Facebook and LinkedIn fall back to the page's
`<title>`, so the cards they build are right. A consumer that holds to the
protocol may build none, and X's handling of a `summary_large_image` card
without a title is unverified.

### Ideas

- **Read the `<title>` as the page is copied.** The marker already gives the
  place to put `og:title`; what is missing is its text. Finding a page's
  `<title>` is HTML parsing, which the repository has no parser for; a text
  search over rustdoc's markup is the kind of check
  [AGENTS.md §6](../../../AGENTS.md#6-external-tools) rules out. A parser, or
  an approved tool, comes first.
- **Derive the title from the path.** rustdoc names a page by its item —
  `struct.Foo.html` in `nanvm_lib/vm/` is "Foo in nanvm_lib::vm" — so the
  copy could spell the title without reading the page. That is a second
  implementation of rustdoc's naming, which drifts when a rustdoc release
  changes it, and nothing would notice.
- **Leave it.** If the consumers that matter keep falling back, the gap
  stays documented and unfixed.
