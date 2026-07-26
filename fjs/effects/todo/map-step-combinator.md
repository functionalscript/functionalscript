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
`fjs/effects/eff/module.f.ts` so those sites don't have to leave it.

Since [#1360](https://github.com/functionalscript/functionalscript/pull/1360)
an `Eff` is `Eff<O, T, P>`: `P` is the tuple of prior chain values, `.step`'s
callback is applied as `f(t, ...p)`, and the result grows the history —
`Eff<O | Q, R, readonly[T, ...P]>`. `.map` must fit that contract, not the
two-parameter shape:

```ts
export type Eff<O extends Operation, T, P extends readonly unknown[]> = {
    readonly value: Effect<O, T>
    readonly step: <Q extends Operation, R>(f: (t: T, ...p: P) => Effect<Q, R>) => Eff<O | Q, R, readonly[T, ...P]>
    readonly map: <R>(f: (t: T, ...p: P) => R) => Eff<O, R, readonly[T, ...P]>
}
```

**History grows, exactly as it does for `.step`.** This is forced, not a
preference: `.map(f)` has to be observationally identical to
`.step((t, ...p) => pure(f(t, ...p)))`, because that is the rewrite this issue
performs at every fluent site. Preserving `P` unchanged instead would mean the
mechanical conversion silently changes what *later* callbacks in the chain
receive — a behavioural change disguised as a readability one. `O` does not
widen (no `Q`), for the same reason it doesn't in `mapStep`: a pure projection
issues no commands.

**Conversion hazard: callback arity.** `Eff`'s own docs warn that the history is
positional, so "every parameter a callback declares is meaningful … a defaulted
or rest parameter after the current value is a bug, not a convenience." A
conversion from `.step(y => pure(f(y)))` to `.map(f)` is only safe when `f` is
genuinely unary — the explicit lambda pins arity at one, while passing `f`
point-free exposes it to the prior values. This is `["1","2","3"].map(parseInt)`
with a longer history tuple. When converting, either keep the lambda or confirm
the callee takes exactly one argument; `mapOk(utf8ToString)` and
`vecToCBase32` qualify, and anything with optional parameters does not.

**Scope.** `AGENTS.md` asks one improvement per PR, and it also asks that a new
`export` ship with at least one external consumer *in the same change* — so the
first PR adds the two APIs **and converts a first caller of each**, rather than
landing them with proof coverage alone:

1. `mapStep` + `Eff.map`, plus the nearest real consumers — `readUtf8File` and
   `errorExit` in `fjs/effects/node/module.f.ts` (raw, one projection and one
   constant projection) and `decodeRevisionBlob` in `fjs/cas/evo/module.f.ts:164-166`
   (fluent). Each API is exercised by production code the moment it exists.
2. …n. The remaining ~42 sites, grouped by module.

Splitting this way keeps the first diff small without leaving a speculative
export behind it. What must **not** happen is the reverse — landing the
conversion as one 15-module diff.

### Tasks

First PR — both APIs, each with a real consumer landing alongside it:

- [ ] Add `mapStep` to `fjs/effects/module.f.ts` with proof coverage in
      `fjs/effects/proof.f.ts`; document it in the module header alongside the
      "step adapters vs. step variants" note.
- [ ] Add `Eff.map` to `fjs/effects/eff/module.f.ts` with the `Eff<O, T, P>`
      signature above (history grows by `T`, `O` unchanged) and proof coverage
      that pins the history contract — a `.map(...).step(...)` chain asserting
      the second callback still sees the pre-`map` value.
- [ ] In the same PR, convert `readUtf8File`, `awaitIfPromise` and `errorExit`
      in `fjs/effects/node/module.f.ts` to `mapStep`, and `decodeRevisionBlob`
      (`fjs/cas/evo/module.f.ts:164-166`) to `Eff.map` — so neither export is
      speculative.
- [ ] When converting fluent sites, check callback arity (see the hazard note
      above) rather than mechanically dropping the lambda.

Follow-up PRs — the remaining sites, one module or group per PR:

- [ ] The `NodeProgram` exit-code sites (`fjs/module.f.ts`, `fjs/cli`, `fjs/ci`,
      `fjs/djs`, `fjs/website`, `fjs/cas/cli`).
- [ ] `fjs/mcp` + `fjs/mcp/stdio`, `fjs/cas` + `fjs/cas/evo` + `fjs/cas/mcp`,
      `fjs/emergent_testing`, `fjs/dev`.
- [ ] `npx tsc` clean; `fjs t` passes after each PR.

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
