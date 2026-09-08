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
- **A demo is pure, and asks for what it needs as an effect.** A demo module
  is FunctionalScript, so it cannot touch the DOM, register a listener, read a
  clock, or fetch. `update` returns an `Effect` from
  [`fjs/effects`](../../effects/README.md) describing the host operations it
  needs, and one shared impure runtime — written once, in `fjs/website/` — is
  the runner that interprets browser operations and resumes the effect until
  it yields the next `State`. This is the program model the website generator
  already follows: the description is pure and proven against a virtual
  runner, and the impure runner is one `OperationMap` beside it. Allowing an
  impure `demo.mjs` per module was the alternative; it is the "migration debt"
  that [`AGENTS.md` §3](../../../AGENTS.md#3-functionalscript-and-typescript-fjs)
  names, multiplied by every demo.
- **A pure demo is the `O = never` case, not a second convention.** Its
  `update` returns `pureOk(state)`, which is an `Effect<never, State, never>`,
  so the type below covers the first demo unchanged and the runtime needs no
  special path for it.
- **`update` returns `Effect<O, State, never>`.** A demo has no error channel
  separate from its rendered state. Recoverable operation failures are handled
  by the demo and represented in `State`, where `view` can render them;
  `never` states that the demo absorbs every recoverable failure before
  returning its next state. `notImplemented` is one of those failures — the
  runtime declines an operation it has no handler for, and the demo shows
  that, which is what lets the runtime start with no capabilities at all. A
  throw inside `update` or `view` is not recoverable: it is a defect, and the
  runtime reports it the way a failed proof is reported, never as a state.
- **Events are serialized.** A browser operation is asynchronous, so an event
  can arrive while an `update` is in flight. One `update` runs at a time;
  later events queue in order; state advances only when an effect completes.
  Deterministic, and reproducible by the virtual runner in a proof. A demo
  that finds this too slow is the case that decides otherwise, and there is
  none yet.
- **Startup work is an event.** `init` stays a `State`. A demo that needs an
  operation before it can show anything encodes a loading state, and the
  runtime sends one synthetic `{ kind: 'start' }` event after the first
  render.
- **No subscriptions.** `Effect` is request and response. A clock that ticks
  or a stream that keeps arriving needs a `subscriptions` field in the Elm
  style, which is a second mechanism; it is left out rather than expressed as
  an effect that never completes.
- This replaces the `page.f.mjs` convention named in
  [generate-website](generate-website.md) and `todo/samples.md`, which was
  never implemented.

### Proposal

The demo module exports:

```js
/** @type {Demo<State, Event, O>} */
export const demo = { init, update, view }
```

```ts
type Demo<State, Event, O extends Operation> = {
    readonly init: State
    readonly update: (state: State) => (event: Event) => Effect<O, State, never>
    readonly view: (state: State) => Node
}
```

- `init: State` — the initial state.
- `update` — an event is what the runtime observed:
  `{ kind: 'input', name: string, value: string }` and `{ kind: 'start' }`
  for now, extended only when a demo needs more. The result is an effect over
  the operations the demo declares in `O`; a pure demo declares `never`.
- `view: (state: State) => Node` — a
  [`media/html`](../../media/html/module.f.mjs) tree. Interactive elements
  carry a `name` attribute; that name is what comes back in the event.

The page names the module that carries the export — `./demo.f.mjs` or
`./module.f.mjs`, whichever the scan found — in a `data-demo` attribute on the
demo section, so the runtime never guesses a filename.

`fjs/website/demo-runtime.mjs` (impure, shared) imports the path in
`data-demo`, renders `view(init)` into the demo section, sends `start`, then
listens for `input` events on that section, maps each to an `Event`, runs
`update`'s effect through `asyncRun` over the browser operation map, and
re-renders with the state it yields. The map starts empty — `partialMatch`
over no commands, so every operation answers `notImplemented` — and grows one
handler at a time. Each handler lands with its virtual counterpart, so a
demo's proof drives `update` against the virtual browser runner the way the
website proof drives the generator against `effects/node/virtual`. Replacing
the section's contents wholesale is enough until a demo is large enough to
notice; a diff is not this issue.

Where the operations live: a browser vocabulary in `fjs/effects/browser/`
mirroring `effects/node/` — `types.ts` for the operations, the impure runner
beside it, a virtual runner under it. An operation that is not the browser's
own (`now`, `random`) belongs in `effects/common`. Neither exists yet, and
the first pure demo needs neither.

First demo: `fjs/crypto/sha2/demo.f.mjs` — a text field, and beneath it the
SHA-256 digest of its UTF-8 bytes in cBase32, the encoding the CAS uses. Its
`proof.f.mjs` checks `view(init)` and `update` on a known input against the
digest the module's own proof already asserts.

### Tasks

- [ ] `Demo<State, Event, O>` in `fjs/website/demo/types.ts`, with `update`
      returning `Effect<O, State, never>`; the event type in the same file.
- [ ] Generalise `exportsProof` to the export name, so the scan answers
      `demo` as it answers `proof`; keep `exportsProof` as its partial
      application.
- [ ] Page generator: find the directory's demo module by export, refuse two,
      run the blocker analysis on it, and emit the demo section with
      `data-demo` and the runtime script — or the blocker, listed.
- [ ] `fjs/website/demo-runtime.mjs`: import the `data-demo` path, render,
      send `start`, listen, run each `update` through `asyncRun` over an empty
      operation map, one event at a time, re-render. Report a throw as a
      defect.
- [ ] `fjs/crypto/sha2/demo.f.mjs` with `O = never`, and its `proof.f.mjs`.
- [ ] When the first demo needs an operation: `fjs/effects/browser/` with that
      one operation, its impure handler, and its virtual counterpart, each
      proven — a PR of its own.
- [ ] Update the `page.f.mjs` mention in
      [`todo/samples.md`](../../../todo/samples.md) to the `demo` export
      ([generate-website](generate-website.md) is already updated).

### Related

- [An `index.html` for every module directory](directory-index-pages.md) —
  the page a demo renders into.
- [Discovery: the `proof` export](../../emergent_testing/README.md#discovery-the-proof-export)
  — the rule this convention copies.
- [`fjs/effects`](../../effects/README.md) — the effect layer `update` returns
  into, and where `NotImplemented` is defined as recoverable.
- [Generate website](generate-website.md) — the `page.f.mjs` line this replaces.
- [`todo/samples.md`](../../../todo/samples.md) — samples should feed demos
  rather than duplicate them.
- [`fjs/types/bigint/benchmark.html`](../../types/bigint/benchmark.html) — the
  hand-written precedent this convention retires.
