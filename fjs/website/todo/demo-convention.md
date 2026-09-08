## A `demo` export — an interactive demo on a module page

**Priority:** P3
**Status:** open
**Blocked by:** [An `index.html` for every module directory](directory-index-pages.md#an-indexhtml-for-every-module-directory)

### Problem

A module page can show what a module *is* and whether it *passes*, but not
what it *does*. A hash function is best understood by typing into a field and
watching the digest change; a parser by feeding it text; a data structure by
drawing it. Nothing on the site lets a module author offer that, and the one
demo-like file in the tree (`fjs/types/bigint/benchmark.html`) is hand-written
HTML with a hand-written `.mjs` beside it.

### Decisions

- **A demo is discovered the way a proof is: by its export, not its
  filename.** A module is a demo module if and only if it exports `demo`, as a
  module is a proof module if and only if it exports `proof`
  ([emergent_testing](../../emergent_testing/README.md#discovery-the-proof-export)).
  The generator asks that question of every authored module in a directory
  with the same textual scan `exportsProof` in
  [`browser-source`](../browser-source/module.f.mjs) already performs,
  parameterised by the name; a page whose directory has no demo module shows
  no demo section. Keying on a filename would make the demo the one convention
  in the repository that a proof-style rule does not cover, and it is the rule
  the runner deliberately rejects for `.f.mjs`.
- **`demo.f.mjs` is the preferred home, and `module.f.mjs` is allowed.** The
  same two-layer convention as proofs: the mechanism keys on the export, the
  style rule says where it normally lives. A separate file keeps the demo's
  view code out of the module's dependency closure, which is the reason it is
  the default; an inline `export const demo` in `module.f.mjs` is the same
  trade-off as an inline `proof`, and ten modules already make it. A directory
  with more than one demo module is refused by the generator, not resolved by
  a precedence rule — a page has one demo section.
- **A demo module must link in a browser.** It is loaded by the page, so the
  blocker analysis the manifest already applies to proofs applies to it: a demo
  module reaching `node:fs` or a bare specifier is listed with its blocker and
  not loaded, the same answer a non-linkable proof gets.
- **A demo is pure.** A demo module is FunctionalScript, so it cannot touch the
  DOM or register a listener. Instead it exports a pure description of the
  demo, and one shared impure runtime — written once, in `fjs/website/` —
  drives every demo. A demo is therefore provable like any other `.f.mjs`,
  which the coverage rule requires anyway, and a demo author writes no
  host-specific code. Allowing an impure `demo.mjs` per module was the
  alternative; it is the "migration debt" that
  [`AGENTS.md` §3](../../../AGENTS.md#3-functionalscript-and-typescript-fjs)
  names, multiplied by every demo.
- This replaces the `page.f.mjs` convention named in
  [generate-website](generate-website.md) and `todo/samples.md`, which was
  never implemented.

### Proposal

The demo module exports:

```js
/** @type {Demo<State, Event>} */
export const demo = { init, update, view }
```

- `init: State` — the initial state.
- `update: (state: State) => (event: Event) => State` — an event is what the
  runtime observed: `{ kind: 'input', name: string, value: string }` for now,
  extended only when a demo needs more.
- `view: (state: State) => Node` — a
  [`media/html`](../../media/html/module.f.mjs) tree. Interactive elements
  carry a `name` attribute; that name is what comes back in the event.

The page names the module that carries the export — `./demo.f.mjs` or
`./module.f.mjs`, whichever the scan found — in a `data-demo` attribute on the
demo section, so the runtime never guesses a filename.

`fjs/website/demo-runtime.mjs` (impure, shared) imports the path in
`data-demo`, renders `view(init)` into the demo section, listens for `input`
events on that section, maps each to an `Event`, applies `update`, re-renders.
Replacing the section's contents wholesale is enough until a demo is large
enough to notice; a diff is not this issue.

First demo: `fjs/crypto/sha2/demo.f.mjs` — a text field, and beneath it the
SHA-256 digest of its UTF-8 bytes in cBase32, the encoding the CAS uses. Its
`proof.f.mjs` checks `view(init)` and `update` on a known input against the
digest the module's own proof already asserts.

A demo that needs time, randomness, or a fetch needs an effect, and the runtime
supplies none. That is deliberate: such a demo describes what it needs as data,
the runtime grows one capability, both interpretations are proven — the same
rule the website `NodeProgram` follows. Not in this issue.

### Tasks

- [ ] `Demo<State, Event>` in `fjs/website/demo/types.ts`; the event type in
      the same file.
- [ ] Generalise `exportsProof` to the export name, so the scan answers
      `demo` as it answers `proof`; keep `exportsProof` as its partial
      application.
- [ ] Page generator: find the directory's demo module by export, refuse two,
      run the blocker analysis on it, and emit the demo section with
      `data-demo` and the runtime script — or the blocker, listed.
- [ ] `fjs/website/demo-runtime.mjs`: import the `data-demo` path, render,
      listen, update, re-render.
- [ ] `fjs/crypto/sha2/demo.f.mjs` and its `proof.f.mjs`.
- [ ] Update the `page.f.mjs` mention in
      [`todo/samples.md`](../../../todo/samples.md) to the `demo` export
      ([generate-website](generate-website.md) is already updated).

### Related

- [An `index.html` for every module directory](directory-index-pages.md) —
  the page a demo renders into.
- [Discovery: the `proof` export](../../emergent_testing/README.md#discovery-the-proof-export)
  — the rule this convention copies.
- [Generate website](generate-website.md) — the `page.f.mjs` line this replaces.
- [`todo/samples.md`](../../../todo/samples.md) — samples should feed demos
  rather than duplicate them.
- [`fjs/types/bigint/benchmark.html`](../../types/bigint/benchmark.html) — the
  hand-written precedent this convention retires.
