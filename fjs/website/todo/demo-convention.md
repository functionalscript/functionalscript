## `demo.f.mjs` — an interactive demo on a module page

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

- **The file is `demo.f.mjs`, optional, next to `module.f.mjs`.** A page whose
  directory has one loads it; a page whose directory has none shows no demo
  section. This replaces the `page.f.mjs` convention named in
  [generate-website](generate-website.md) and `todo/samples.md`, which was
  never implemented; both mentions are updated by the PR that lands this.
- **A demo is pure.** `demo.f.mjs` is FunctionalScript, so it cannot touch the
  DOM or register a listener. Instead it exports a pure description of the
  demo, and one shared impure runtime — written once, in `fjs/website/` —
  drives every demo. A demo is therefore provable like any other `.f.mjs`,
  which the coverage rule requires anyway, and a demo author writes no
  host-specific code. Allowing an impure `demo.mjs` per module was the
  alternative; it is the "migration debt" that
  [`AGENTS.md` §3](../../../AGENTS.md#3-functionalscript-and-typescript-fjs)
  names, multiplied by every demo.

### Proposal

`demo.f.mjs` exports:

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

`fjs/website/demo-runtime.mjs` (impure, shared) imports the page's
`./demo.f.mjs`, renders `view(init)` into the demo section, listens for `input`
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
- [ ] `fjs/website/demo-runtime.mjs`: import, render, listen, update, re-render.
- [ ] Page generator: emit the demo section and the runtime script when the
      walk finds `demo.f.mjs` in the directory.
- [ ] `fjs/crypto/sha2/demo.f.mjs` and its `proof.f.mjs`.
- [ ] Update the `page.f.mjs` mentions in [generate-website](generate-website.md)
      and [`todo/samples.md`](../../../todo/samples.md) to `demo.f.mjs`.

### Related

- [An `index.html` for every module directory](directory-index-pages.md) —
  the page a demo renders into.
- [Generate website](generate-website.md) — the `page.f.mjs` line this replaces.
- [`todo/samples.md`](../../../todo/samples.md) — samples should feed demos
  rather than duplicate them.
- [`fjs/types/bigint/benchmark.html`](../../types/bigint/benchmark.html) — the
  hand-written precedent this convention retires.
