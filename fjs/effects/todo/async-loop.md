## async-loop. `asyncRun` and `asyncPartialRun` copy the drive loop `mock` shares

**Priority:** P5
**Status:** open

### Problem

`fjs/effects/mock/module.f.mjs` runs its total and partial interpreters
through one `_loop`, with `run = o => _loop(match(o))` and `partialRun`
supplying its `onMissing` injector. The async runner in
`fjs/effects/module.mjs` did not follow:

```js
// asyncRun                                  // asyncPartialRun
const next = match(map)                      const next = partialMatch(commands, onMissing)(map)
while (true) {                               while (true) {
    const r = next(effect)                       const r = next(effect)
    if (r[0] === 'done') { return r[1] }         if (r[0] === 'done') { return r[1] }
    effect = r[2](await r[1])                    effect = r[2](await r[1])
}                                            }
```

`match` and `partialMatch` were unified behind `_matchWith` so the number
of places that read the effect representation stays enumerable; the loop
is the last place the two variants diverge only by copy.

### Proposal

`_asyncLoop = next => async effect => { … }` in `fjs/effects/module.mjs`,
with `asyncRun = map => _asyncLoop(match(map))` and `asyncPartialRun`
mirroring `mock`'s `partialRun`, injector at the runner as its doc argues.

### Tasks

- [ ] `_asyncLoop`; both runners over it; `tsc`, `fjs test`.

### Related

- [io-effect-migration.md](./io-effect-migration.md) — why the two runners
  exist; treats the pair as settled and does not mention the loop.
