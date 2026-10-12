## rustdoc's pages show the Rust favicon

**Priority:** P3
**Status:** open

### Problem

The pages under `/cargo.doc/` carry the site's header and footer, but their
tab shows rustdoc's favicon, the Rust logo, not the site's "fjs". rustdoc
writes two icon links into every page's `<head>`:

```html
<link rel="alternate icon" type="image/png" href="../static.files/favicon-32x32-….png">
<link rel="icon" type="image/svg+xml" href="../static.files/favicon-….svg">
```

The header and footer go into the body (`--html-before-content`,
`--html-after-content`), so nothing the site gives rustdoc reaches the
`<head>` today.

### Option 1: one more file and flag (recommended)

The generator also writes `_rustdoc-head.html` holding the site's two icon
links — the same `faviconLinks` from [`../style/module.f.js`](../style/module.f.js)
every page uses, so the two cannot drift — and `cargo doc` takes it as
`--html-in-header`, beside the three flags it already takes.

- **For:** the same pattern as the header and footer: generated, one source,
  no Rust code touched.
- **Against:** rustdoc's own two links stay in the page. Measured on the
  shell's rustdoc 1.99.0, `--html-in-header` places the site's links after
  them, and the HTML standard has a browser use the last of several equally
  appropriate icons — so the site's icon wins on that rule, not because
  rustdoc's is gone. A browser that chose differently, or a rustdoc release
  that moved the injected HTML before its own links, would bring the Rust
  logo back.

### Option 2: the favicon in each crate

Each crate's `lib.rs` names the site's icon:

```rust
#![doc(html_favicon_url = "/fjs/website/favicon.svg")]
```

rustdoc then writes that one link instead of its own.

- **For:** only one icon link on each page; nothing is overridden.
- **Against:** a website URL in the Rust sources, three times, which a new
  crate has to repeat. And a root-relative URL resolves only on this site:
  docs built anywhere else point at an icon that is not there.

### Tasks

- [ ] Choose an option.
- [ ] Wire it: for option 1, the generator writes `_rustdoc-head.html` and the
      build adds `--html-in-header` (the local steps in
      [`../README.md`](../README.md), and the Cloudflare build script if it
      runs `cargo doc` by then).
- [ ] Check the tab icon in a browser on a crate page, after a hard refresh:
      browsers cache a site's favicon.
