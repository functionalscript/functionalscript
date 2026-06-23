# TODO

## Generate website

**Priority:** P3
**Status:** open

- [x] A minimal webpage
- [x] Generate Deno and Rust docs and publish them
- [ ] Convert `README.md` files into HTML and publish them
- [ ] Source code highlighting
- [ ] One `main.css`
- [ ] Convention for `page.f.ts` — generates a demo webpage for the module in the same directory
- [ ] Browser test runner (requires switching test framework to Effects first)

---

## Use `importmap` as `package-lock.json`

**Priority:** P3
**Status:** open

Use [`importmap`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap#integrity_metadata_map) as `package-lock.json` for the website.

---

## Publish `deno doc` to website

**Priority:** P3
**Status:** open

Before or after dropping JSR, publish `deno doc`-generated API documentation to the FunctionalScript website so users have an up-to-date reference.

- [ ] Run `deno doc --html **/module.f.ts` and review the output.
- [ ] Integrate the `deno doc` build step into the website generation pipeline (see [Generate website](#generate-website)).
- [ ] Publish the generated docs alongside the existing website content.

---

## Generate and publish docs

**Priority:** P3
**Status:** open

Generate API documentation using `deno doc` (or other tools) for the website, and `cargo doc` for Rust crates.

---

## Carbon advertisements

**Priority:** P3
**Status:** open

Add [Carbon Ads](https://www.carbonads.net/) to the website.

---

## Short URL table

**Priority:** P3
**Status:** open

---
