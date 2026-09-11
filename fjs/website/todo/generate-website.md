## Generate website

**Priority:** P3
**Status:** open

- [x] A minimal webpage (`fjs/website/module.f.mjs` writes an `index.html` with a single GitHub link)
- [ ] Generate Deno and Rust docs and publish them — see
      [publish-deno-doc-to-website](publish-deno-doc-to-website.md)
- [ ] Convert `README.md` files into HTML and publish them
- [ ] Source code highlighting and per-module JSDoc — see
      [source-and-doc-view](source-and-doc-view.md)
- [x] One `main.css` (`fjs/website/style/module.f.mjs`, written to the root as `_main.css` and linked root-relative)
- [x] One monospace face for the whole site (`ui-monospace` first, `pre`
      inheriting it; the reasoning is [`../README.md`](../README.md))
- [ ] Decide what the build owes its own leftovers — see
      [stale-generated-pages](stale-generated-pages.md)
- [x] Convention for a `demo` export — an optional pure demo, discovered like a
      proof, rendered on its page (`fjs/website/demo/`, `demo-runtime.mjs`;
      the first is `fjs/crypto/sha2/demo.f.mjs`, and the reasoning is
      [`../README.md`](../README.md))
- [x] An `index.html` per module directory, cataloguing its files,
      subdirectories, `todo/` issues and the proofs of its subtree
      (`fjs/website/page/`; the design is [`../README.md`](../README.md))
- [x] Browser test runner and proof-result UI
- [x] Move browser proof-source preparation into the website `NodeProgram`
      through Node effects. Landed in functionalscript#1827: `browser-prepare.mjs`
      is gone and `website/module.f.mjs` decides the sources as part of the
      build. The shared manifest module it wrote has since been replaced by a
      per-page list
