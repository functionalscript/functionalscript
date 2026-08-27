## Own the browser-suite preparation from the website `NodeProgram`

**Priority:** P3
**Status:** open

### Problem

`npm run website` runs `fjs/website/browser-prepare.mjs`, an impure Node script
that is a second application entry point beside the FunctionalScript program in
`fjs/website/module.f.mjs`. It walks the source tree, decides which proof
modules a browser can link, writes `fjs/emergent_testing/_browser-suite.mjs`,
and only then calls `run(main)` to emit the page. Everything it does — reading
directories, reading files, writing generated source — is expressible as Node
effects, so the split exists for no reason other than history, and the
preparation half is proved only through `browser-source.proof.mjs`'s unit tests
of the token scanner rather than end to end against the virtual filesystem.

The [shared browser/console runner](../../emergent_testing/README.md) work that
this issue was carved out of is done: the browser and `fjs t` now run the same
proof semantics, so what is left here is the *build*, not the runner.

### Preliminary design

Restore the package command to the FunctionalScript entry point:

```json
"website": "node ./fjs/module.mjs r ./fjs/website/module.f.mjs"
```

`fjs/website/module.f.mjs` must own proof discovery, manifest generation, and
HTML/entry generation as one `NodeProgram`. If preparation needs a Node
capability that the FunctionalScript program cannot currently express, add the
smallest operation to `fjs/effects/node/` and its real and virtual interpreters
instead of bypassing Effects. Existing `readdir`, `readFile`, and `writeFile`
operations should be reused where sufficient.

`fjs/website/browser-source.mjs` — the token scanner answering "does this
module export `proof`?" and "which modules does it import?" — is already pure
and has no `try`/`catch` or regular expressions. Renaming it to `.f.mjs` and
proving it as authored FunctionalScript is the first step; the graph walk and
the blocker classification then move into the program beside it.

### Constraints

- Website build-time filesystem access must be expressed by the FunctionalScript
  `NodeProgram` through Node effects; npm scripts must not run an impure helper
  as a second application entry point.
- The generated manifest and page must stay byte-identical across the move, so
  the change is provably a refactor.
- Do not restore the removed `index-html` alias.

### Tasks

- [ ] Rename `fjs/website/browser-source.mjs` to authored `.f.mjs` with a
      co-located proof at full coverage.
- [ ] Move static proof discovery and `_browser-suite.mjs` generation into
      `fjs/website/module.f.mjs`; extend `fjs/effects/node/` only for a concrete
      missing capability and prove the real and virtual interpretations.
- [ ] Delete `fjs/website/browser-prepare.mjs` and make the sole `website`
      command `node ./fjs/module.mjs r ./fjs/website/module.f.mjs`.
- [ ] Prove the generator end to end against the virtual filesystem: a module
      whose graph reaches `node:` is skipped with its reason, one that does not
      is emitted.

### Related

- [Generate website](generate-website.md) — the parent issue.
- [Browser testing](../../emergent_testing/todo/browser-testing.md) — the
  browser-native application the manifest feeds.
