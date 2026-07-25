## map-step-combinator. The effect functor `map` is missing — 45 sites spell it as `step(e, x => pure(f(x)))`

**Priority:** P3
**Status:** open

### Problem

`fjs/effects/module.f.ts` ships `pure` (return) and `step` (bind), plus the
derived combinators `frameStep`, `foldStep`, `forEachStep`, and the `okStep`
adapter. The one combinator every monad also has — **`map`**, "run the effect,
then apply a pure function to its result" — is absent, so every call site
re-derives it as `step(e, x => pure(f(x)))`.

That idiom appears **45 times outside proof files**, in 15 modules. Two shapes,
both the same thing:

*Projection* (`x => pure(f(x))`) — 21 sites:

```ts
// fjs/effects/node/module.f.ts:91-95
export const readUtf8File = (path: string): Effect<ReadFile, IoResult<string>> =>
    step(
        readFile(path),
        r => pure(mapOk(utf8ToString)(r))
    )

// fjs/cas/evo/module.f.ts:165
eff(collectRead(cas.read(hash))).step(([tag, value]) => pure(tag === 'error' ? null : decodeRevisionVec(value))).value

// fjs/mcp/module.f.ts:394-396
: step(
    handlers.toolsList(pr),
    r => pure(_okResponse(id)(r)),
)
```

Also `fjs/effects/node/module.f.ts:442-444`, `fjs/dev/module.f.ts:73-75,80-83,115-122`,
`fjs/cas/evo/module.f.ts:372`, `fjs/cas/evo/mcp/module.f.ts:69,78,87`,
`fjs/cas/module.f.ts:200,223,248,261`, `fjs/cas/mcp/module.f.ts:286`,
`fjs/mcp/module.f.ts:407-409`,
`fjs/emergent_testing/module.f.ts:203,208,210,226,325`.

*Constant projection* (`() => pure(v)`) — 24 sites, overwhelmingly the
"do the work, then yield an exit code" shape of a `NodeProgram`:

```ts
// fjs/cli/module.f.ts:38-40
return step(
    log(helpText),
    () => pure(0))

// fjs/website/module.f.ts:17-19
const program: Effect<WriteFile, number> = step(
    writeFile('index.html', html),
    () => pure(0))
```

Also `fjs/effects/node/module.f.ts:502-504` (`errorExit`),
`fjs/djs/module.f.ts:31-33,42-44,49-51`, `fjs/module.f.ts:35-37`,
`fjs/ci/module.f.ts:72-74`, `fjs/cas/evo/module.f.ts:184,356`,
`fjs/cas/module.f.ts:148,205,296`, `fjs/cas/cli/module.f.ts:37,72`,
`fjs/cas/mcp/module.f.ts:197`, `fjs/mcp/module.f.ts:335,369-371`,
`fjs/mcp/stdio/module.f.ts:64,109`,
`fjs/emergent_testing/module.f.ts:175,180,227,248,381`.

Two existing issues quote the idiom while proposing something else, which is
itself evidence that it wants a name:
[allreduce-combinator](./allreduce-combinator.md) writes
`all(...).step(rs => pure(rs.reduce(op, init)))` and
[allvoid-combinator](./allvoid-combinator.md) writes
`all(...).step(() => pure(undefined))`.

Beyond the repetition, the current spelling **misreports the shape of the
chain**. A `step` whose continuation returns `pure` is not a link in a sequence
of effects — it is the end of one. `AGENTS.md` asks that a sequence of effects
read top-to-bottom with one name per link; a trailing pure projection is not a
link at all, yet it costs a `step(` and a `pure(` and, when it needs a value from
an earlier link, tempts exactly the nesting the rule forbids:

```ts
// today — the final projection looks like another effect
step(a, x => step(f(x), y => pure(g(x, y))))
```

### Proposal

Add the functor map to `fjs/effects/module.f.ts`, next to `frameStep`, as a
**step variant** (effect first, like `step` and `frameStep`):

```ts
/**
 * Applies a pure function to an effect's result. The functor `map` of the
 * effect monad — `step` whose continuation performs no further effects.
 *
 * Prefer this over `step(e, x => pure(f(x)))`: it says, in the combinator's
 * name, that the chain ends here rather than continuing with another effect.
 */
export const mapStep = <O extends Operation, T, R>(
    e: Effect<O, T>,
    f: (t: T) => R
): Effect<O, R> =>
    step(e, t => pure(f(t)))
```

Note `mapStep` does **not** widen the operation set (`Effect<O, R>`, not
`Effect<O | Q, R>`) — a pure projection adds no commands. That is a small typing
gain over `step` at every one of the 45 sites.

The two shapes above become:

```ts
export const readUtf8File = (path: string): Effect<ReadFile, IoResult<string>> =>
    mapStep(readFile(path), mapOk(utf8ToString))

const program: Effect<WriteFile, number> = mapStep(writeFile('index.html', html), () => 0)
```

**One name, not two.** A dedicated constant variant (`constStep(e, v)`) was
considered for the 24 constant sites and rejected: `mapStep(e, () => v)` already
reads clearly, and two exported names for one concept costs more than the six
characters it saves. It would also change evaluation timing (`v` eagerly at
construction rather than inside the continuation), which is invisible for the
cheap pure values used today but is a semantic difference not worth introducing
for brevity.

**`Eff` gets the same method.** Roughly a third of the sites are already in the
fluent world (`eff(x).step(y => pure(f(y))).value`). Add the matching method to
`fjs/effects/eff/module.f.ts` so those sites don't have to leave it:

```ts
export type Eff<O extends Operation, T> = {
    readonly value: Effect<O, T>
    readonly step: <Q extends Operation, R>(f: (t: T) => Effect<Q, R>) => Eff<O | Q, R>
    readonly map: <R>(f: (t: T) => R) => Eff<O, R>
}
```

**Scope.** `AGENTS.md` asks one improvement per PR; this is naturally two:
(1) add `mapStep` (+ `Eff.map`) with proof coverage, (2..n) convert call sites,
grouped by module. The combinator is worth adding on its own — it has 45
consumers on day one — but the conversion should not land as one 15-module diff.

### Tasks

- [ ] Add `mapStep` to `fjs/effects/module.f.ts` with proof coverage in
      `fjs/effects/proof.f.ts`; document it in the module header alongside the
      "step adapters vs. step variants" note.
- [ ] Add `Eff.map` to `fjs/effects/eff/module.f.ts` with proof coverage.
- [ ] Convert call sites module by module, starting with `fjs/effects/node`
      (`readUtf8File`, `awaitIfPromise`, `errorExit`) and the `NodeProgram`
      exit-code sites (`fjs/module.f.ts`, `fjs/cli`, `fjs/ci`, `fjs/djs`,
      `fjs/website`, `fjs/cas/cli`).
- [ ] `npx tsc` clean; `fjs t` passes after each step.

### Related

- [allreduce-combinator](./allreduce-combinator.md) — its proposed body
  (`all(...).step(rs => pure(rs.reduce(...)))`) is `mapStep` over `all`; landing
  this first simplifies it.
- [allvoid-combinator](./allvoid-combinator.md) — same, with a constant
  projection (`() => undefined`).
- [fold-stream-combinator](./fold-stream-combinator.md) — its pure consumers
  (`detectStream`, `collectRead`) end in `pure(ok(...))` projections.
- `fjs/effects/module.f.ts` — `step`, `frameStep`, `foldStep`, `forEachStep`,
  `okStep`; the "do not nest steps" rule in the module header.
