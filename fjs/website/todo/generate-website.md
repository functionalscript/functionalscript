## Generate website

**Priority:** P3
**Status:** open

- [x] A minimal webpage (`fjs/website/module.f.mjs` writes an `index.html` with a single GitHub link)
- [ ] Generate Deno and Rust docs and publish them
- [ ] Convert `README.md` files into HTML and publish them
- [ ] Source code highlighting
- [ ] One `main.css`
- [ ] Convention for `page.f.mjs` — generates a demo webpage for the module in the same directory
- [ ] An `index.html` per module directory, cataloguing its files,
      subdirectories, `todo/` issues and local proofs — see
      [directory-index-pages](directory-index-pages.md)
- [x] Browser test runner and proof-result UI
- [x] Move browser-manifest preparation into the website `NodeProgram` through
      Node effects. Landed in functionalscript#1827: `browser-prepare.mjs` is
      gone and `website/module.f.mjs` writes the suite manifest as part of the
      build
