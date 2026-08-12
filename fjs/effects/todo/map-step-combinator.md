## map-step-combinator. Convert the remaining `step(e, x => pure(f(x)))` sites to `mapStep` / `Eff.map`

**Priority:** P3
**Status:** open

> **The APIs have landed.** `mapStep` is in `fjs/effects/module.f.mjs` and
> `Eff.map` in `fjs/effects/eff/module.f.mjs`, each with proof coverage and with
> its first real consumers converted in the same change — `readUtf8File`,
> `awaitIfPromise` and `errorExit` (`fjs/effects/node/module.f.mjs`),
> `decodeRevisionBlob` (`fjs/cas/evo/module.f.ts`), and `Eff`'s own `.step`,
> whose history projection is now a `mapStep`. What remains is the mechanical
> part: the other call sites, module by module.

### Problem

`fjs/effects/module.f.mjs` ships `pure` (return) and `step` (bind), plus the
derived combinators `historyStep`, `foldStep`, `forEachStep`, the `okStep`
adapter — and now `mapStep`, the functor `map`: "run the effect, then apply a
pure function to its result". Before it existed, every call site re-derived it
as `step(e, x => pure(f(x)))`, and **about 41 of them still do**, in 14 modules.

Two shapes, both the same thing:

*Projection* (`x => pure(f(x))`):

```ts
// fjs/protocol/mcp/module.f.ts:394-396
: step(
    handlers.toolsList(pr),
    r => pure(_okResponse(id)(r)),
)
```

Also `fjs/dev/module.f.mjs`, `fjs/cas/evo/module.f.ts`,
`fjs/mcp/evo/module.f.ts`, `fjs/cas/module.f.mjs`, `fjs/mcp/cas/module.f.ts`,
`fjs/protocol/mcp/module.f.ts`, `fjs/emergent_testing/module.f.mjs`.

*Constant projection* (`() => pure(v)`), overwhelmingly the "do the work, then
yield an exit code" shape of a `NodeProgram`:

```ts
// fjs/cli/module.f.mjs:39-41
return step(
    log(helpText),
    () => pure(0))

// fjs/website/module.f.mjs:19-21
const program = step(
    writeFile('index.html', html),
    () => pure(0))
```

Also `fjs/djs/module.f.ts`, `fjs/module.f.ts`, `fjs/ci/module.f.mjs`,
`fjs/cas/evo/module.f.ts`, `fjs/cas/module.f.mjs`, `fjs/cas/cli/module.f.mjs`,
`fjs/mcp/cas/module.f.ts`, `fjs/protocol/mcp/module.f.ts`, `fjs/protocol/mcp/stdio/module.f.ts`,
`fjs/emergent_testing/module.f.mjs`.

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

Rewrite each remaining site with the combinator that already exists:

```ts
mapStep(e, f)                       // raw Effect
eff(e).map(f).value                 // fluent Eff
```

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

**Conversion hazard: callback arity.** `Eff`'s docs warn that the history is
positional, so "every parameter a callback declares is meaningful … a defaulted
or rest parameter after the current value is a bug, not a convenience." A
conversion from `.step(y => pure(f(y)))` to `.map(f)` is only safe when `f` is
genuinely unary — the explicit lambda pins arity at one, while passing `f`
point-free exposes it to the prior values. This is `["1","2","3"].map(parseInt)`
with a longer history tuple. When converting, either keep the lambda or confirm
the callee takes exactly one argument; `mapOk(utf8ToString)` and `vecToCBase32`
qualify, and anything with optional parameters does not. `mapStep` is not exposed
to this — it applies `f` to exactly one argument — so only the fluent sites need
the check.

**Scope.** `AGENTS.md` asks one improvement per PR. Take one module or one
closely related group per PR; what must **not** happen is landing the whole
conversion as one 14-module diff.

### Tasks

- [ ] The `NodeProgram` exit-code sites (`fjs/module.f.ts`, `fjs/cli`, `fjs/ci`,
      `fjs/djs`, `fjs/website`, `fjs/cas/cli`).
- [ ] `fjs/protocol/mcp` + `fjs/protocol/mcp/stdio`.
- [ ] `fjs/cas` + `fjs/cas/evo` + `fjs/mcp/evo` + `fjs/mcp`.
- [ ] `fjs/emergent_testing`, `fjs/dev`.
- [ ] When converting fluent sites, check callback arity (see the hazard note
      above) rather than mechanically dropping the lambda.
- [ ] `npx tsc` clean; `fjs t` passes after each PR.

### Related

- [allreduce-combinator](./allreduce-combinator.md) — its proposed body
  (`step(all(...), rs => pure(rs.reduce(...)))`) is `mapStep` over `all`, so it
  can now be written that way directly.
- [allvoid-combinator](./allvoid-combinator.md) — same, with a constant
  projection (`() => undefined`).
- [fold-stream-combinator](./fold-stream-combinator.md) — its pure consumers
  (`detectStream`, `collectRead`) end in `pure(ok(...))` projections.
- `fjs/effects/module.f.mjs` — `mapStep`, `step`, `historyStep`, `foldStep`,
  `forEachStep`, `okStep`; the "do not nest steps" rule in the module header.
</content>
