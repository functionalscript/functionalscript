## map-step-combinator. Convert the remaining `step(e, x => pureOk(f(x)))` sites to `mapStep`

**Priority:** P3
**Status:** open

> **The API has landed.** `mapStep` is in `fjs/effects/module.f.mjs` with proof
> coverage, and its first real consumers were converted in the same change —
> `readUtf8File`, `awaitIfPromise` and `errorExit`
> (`fjs/effects/node/module.f.mjs`) and `decodeRevisionBlob`
> (`fjs/cas/evo/module.f.mjs`). What remains is the mechanical part: the other
> call sites.

### Problem

`fjs/effects/module.f.mjs` ships `pure` (return) and `step` (bind), plus the
derived combinators `historyStep`, `foldStep`, `forEachStep` — and now
`mapStep`, the functor `map`: "run the effect, then apply a
pure function to its result". Before it existed, every call site re-derived it.
This issue was filed against `step(e, x => pure(f(x)))`; since every effect
carries a `Result`, that spelling no longer compiles, and the projection is now
written `step(e, x => pureOk(f(x)))`. The constant projection it also listed —
`() => pure(0)` ending a `NodeProgram` — became `exitStep` instead, and no site
of that shape is left.

At `36c8d4a` a few projection sites remain:

```js
// fjs/protocol/mcp/module.f.mjs — the `tools/list` and `tools/call` responses
: ioStep(
    handlers.toolsList(pr),
    r => pureOk(successResponseOf(id)(r)),
)
```

- the `tools/list` and `tools/call` responses in `fjs/protocol/mcp/module.f.mjs`;
- the per-file step of `scan` in `fjs/website/module.f.mjs`;
- `linkModule` in `fjs/fsc/edag/module.f.mjs`.

`step(all(…), rs => pure(okList(rs)))` in `allOk`
(`fjs/effects/common/module.f.mjs`) and `_parseModule` in
`fjs/fsc/transpiler/module.f.mjs` are channel constructors, not `mapStep`
candidates: their continuations build the `Result` itself.

Beyond the repetition, the old spelling **misreports the shape of the chain**.
A `step` whose continuation returns `pure` is not a link in a sequence of
effects — it is the end of one. `AGENTS.md` asks that a sequence of effects read
top-to-bottom with one name per link; a trailing pure projection is not a link
at all, yet it costs a `step(` and a `pure(` and, when it needs a value from an
earlier link, tempts exactly the nesting the rule forbids:

```ts
// the old spelling — the final projection looks like another effect
step(a, x => step(f(x), y => pure(g(x, y))))
```

### Proposal

Rewrite each remaining site with the combinator that already exists —
`mapStep(e, f)`.

`mapStep` does **not** widen the operation set (`Effect<O, R>`, not
`Effect<O | Q, R>`) — a pure projection adds no commands. That is a small typing
gain over `step` at every site.

**One name, not two.** A dedicated constant variant (`constStep(e, v)`) was
considered for the constant-projection sites and rejected: `mapStep(e, () => v)`
already reads clearly, and two exported names for one concept costs more than the
six characters it saves. It would also change evaluation timing (`v` eagerly at
construction rather than inside the continuation), which is invisible for the
cheap pure values used today but is a semantic difference not worth introducing
for brevity. The rationale is recorded in `mapStep`'s JSDoc.

**No callback-arity hazard here.** `mapStep` applies `f` to exactly one
argument, so passing a callee point-free cannot expose it to extra arguments the
way `["1","2","3"].map(parseInt)` does.

**Scope.** `AGENTS.md` asks one improvement per PR. Take one module or one
closely related group per PR.

### Tasks

- [ ] `fjs/protocol/mcp`: the `tools/list` and `tools/call` responses.
- [ ] `fjs/website`: `scan`'s per-file step.
- [ ] `fjs/fsc/edag`: `linkModule`.
- [ ] `tsc` clean; `fjs t` passes after each PR.

### Related

- [allreduce-combinator](./allreduce-combinator.md) — its proposed body
  (`step(all(...), rs => pure(rs.reduce(...)))`) is `mapStep` over `all`, so it
  can now be written that way directly.
- [allvoid-combinator](./allvoid-combinator.md) — same, with a constant
  projection (`() => undefined`).
- `fjs/effects/module.f.mjs` — `mapStep`, `step`, `historyStep`, `foldStep`,
  `forEachStep`; the "do not nest steps" rule in the module header.
