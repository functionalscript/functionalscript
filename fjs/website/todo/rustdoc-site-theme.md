## Extend rustdoc's look to the site's

**Priority:** P3
**Status:** open

### Problem

rustdoc's pages under `/cargo.doc/` carry the site's header and footer, and
nothing else of the site: between the two bars, the face, the colours, the
link colour and the sidebar are rustdoc's own. A reader moving from a
directory page to its crate's reference crosses from one design into another.

`_rustdoc.css`, which `cargo doc` takes as `--extend-css`, styles only the bars
today, plus the two layout rules the bars need
([`../style/module.f.mjs`](../style/module.f.mjs)'s `rustdocStylesheet`). The
same file can restyle the rest.

### Ideas

- **The face.** The site is set in one monospace face
  ([`../README.md`](../README.md#one-face-the-whole-site)); rustdoc sets prose
  in a serif (Source Serif 4), its interface in a sans-serif (Fira Sans) and
  code in a monospace face. Setting them in the site's face is a few rules.
- **The colours.** rustdoc names its colours as custom properties
  (`--main-background-color`, `--link-color` and the like) per theme. Mapping
  them to the site's tokens would make the page's background, text and links
  the site's, in both schemes.
- **The themes.** rustdoc offers light, dark and ayu, and a settings page to
  pick one; the site follows the system's scheme only. Either the site's
  colours apply to rustdoc's light and dark themes and ayu stays as it is, or
  `--default-theme` and the settings are left alone and only the shared parts
  are restyled.

### Drawbacks

Every rule here leans on rustdoc's internals: its class names, its custom
property names, its layout. None of them is a stable interface, and a Rust
release can rename them, which leaves a rule that silently matches nothing.
The pinned toolchain (`fjs/ci/config/module.f.js`) bounds when that can
happen, but each Rust update would want a look at the reference.

The two layout rules the bars already need are this risk at its smallest. Each
rule added here grows it.

### Tasks

- [ ] Decide how far to go: the face only, the face and the colours, or the
      themes too.
- [ ] Add the rules to `rustdocStylesheet`, each saying which rustdoc
      internal it leans on.
- [ ] Check the reference in both schemes and at phone width.
