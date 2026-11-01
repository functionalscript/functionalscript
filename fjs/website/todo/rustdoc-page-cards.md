## Per-page card tags on rustdoc pages

**Priority:** P3
**Status:** open

Depends on [link-previews](link-previews.md). Until it lands, `rustdocHead`
holds only the favicon links, so every card tag is missing on these pages;
this issue is what remains once it has.

### Problem

The Rust API reference under `/cargo.doc/<crate>/` lacks `og:title` and
`og:url`, which the [Open Graph protocol](https://ogp.me/) requires on every
page. `cargo doc` writes those pages, and the site adds only one fixed
fragment to each `<head>`, `rustdocHead` in
[`../cargo-doc/module.f.mjs`](../cargo-doc/module.f.mjs), through
`--html-in-header`. It is the same on every page, so once link-previews
lands it carries only the tags that do not vary by page: `og:site_name`,
`og:type`, `og:image` and `twitter:card`.

Slack, Discord, Telegram, Facebook and LinkedIn fall back to the page's
`<title>` and the URL they fetched, so the cards they build are right. A
consumer that holds to the protocol may build none, and X's handling of a
`summary_large_image` card without a title is unverified.

### Ideas

- **Rewrite each page as it is copied.** The generator copies rustdoc's
  output into `cargo.doc/` byte for byte. Copying it through a step that
  adds `og:title`, from the page's `<title>`, and `og:url`, from its path,
  would complete every page. Finding the `<title>` and the end of `<head>` is
  HTML parsing, which the repository has no parser for; a text search over
  rustdoc's markup is the kind of check [AGENTS.md §6](../../../AGENTS.md#6-external-tools)
  rules out. A parser, or an approved tool, comes first.
- **Leave it.** If the consumers that matter keep falling back, the gap
  stays documented and unfixed.
