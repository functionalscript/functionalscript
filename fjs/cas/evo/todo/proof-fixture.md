## proof-fixture. Share the Evo proof fixture between `cas/evo` and `mcp/evo`

**Priority:** P4
**Status:** open

### Problem

The three-line Evo setup preamble is repeated ~50 times across two proof
files — 44 `fileCas(sha256)(home)` occurrences in `fjs/cas/evo/proof.f.mjs`
(e.g. `:69`, `:74`, `:81`, …) and 10 in `fjs/mcp/evo/proof.f.mjs` (e.g.
`:57-59`, `:71-73`, …):

```js
const c = fileCas(sha256)(home)
const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
const e = evo(c)(cacheKey)
```

`fjs/cas/evo/proof.f.mjs` additionally defines three reusable `Cas` stubs —
`writeFailingCas` (`:35`), `readFailingCas` (`:45`), `fixedCas` (`:56`) — that
`fjs/mcp/evo/proof.f.mjs` cannot reach, so any new Evo-over-MCP failure-path
test would re-derive them.

### Proposal

Export one fixture from `fjs/cas/evo/proof.f.mjs`. `assertPure` in
`fjs/effects/proof.f.mjs` was exported for the same kind of sharing; its last
cross-file importer went away with the `Eff` experiment, and it is a local
`const` again, so this proposal has no precedent left to lean on:

```js
/** @type {(home: string) => readonly [State, Evo, Key<Cache>]} */
export const freshEvo = home => {
    const c = fileCas(sha256)(home)
    const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
    return [state0, evo(c)(cacheKey), cacheKey]
}
```

plus exports for the three `Cas` stubs. Both proof files call `freshEvo`; the
per-test bodies keep only what they actually vary.

### Tasks

- [ ] Add `freshEvo` (and export the stub `Cas` implementations) in
      `fjs/cas/evo/proof.f.mjs`; rewrite its tests through it.
- [ ] `fjs/mcp/evo/proof.f.mjs`: import the fixture.
- [ ] `fjs t` — both proof suites pass unchanged.

### Related

- `fjs/effects/proof.f.mjs` — `assertPure`, a proof helper of the same shape.
  It was exported and is not any more, having never gained a cross-file
  importer.
