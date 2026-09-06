## Generate website

**Priority:** P3
**Status:** open

- [x] A minimal webpage (`fjs/website/module.f.mjs` writes an `index.html` with a single GitHub link)
- [ ] Generate Deno and Rust docs and publish them — see
      [publish-deno-doc-to-website](publish-deno-doc-to-website.md)
- [ ] Convert `README.md` files into HTML and publish them
- [ ] Source code highlighting and per-module JSDoc — see
      [source-and-doc-view](source-and-doc-view.md)
- [ ] One `main.css` — see [main-css](main-css.md)
- [ ] Convention for `demo.f.mjs` — an optional pure demo next to a module,
      rendered on its page — see [demo-convention](demo-convention.md)
- [ ] An `index.html` per module directory, cataloguing its files,
      subdirectories, `todo/` issues and the proofs of its subtree — see
      [directory-index-pages](directory-index-pages.md)
- [x] Browser test runner and proof-result UI
- [x] Move browser-manifest preparation into the website `NodeProgram` through
      Node effects. Landed in functionalscript#1827: `browser-prepare.mjs` is
      gone and `website/module.f.mjs` writes the suite manifest as part of the
      build
