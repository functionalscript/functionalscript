## step-adapters. `okStep` / `mapOk` and the step-adapter helper shape

**Priority:** P3
**Status:** open

### Problem

Two recurring duplications around `Effect<O, IoResult<T>>`.

**1. The ok-short-circuit continuation is hand-written at every site** — "error →
return it unchanged, ok → continue":

- `writeLoop` (`fs/effects/node/module.f.ts:220-225`):

  ```ts
  .step((r): Effect<O | WriteBytes, IoResult<void>> => {
      if (r[0] === 'error') { return pure(r) }
      return f(offset + Number(lenV >> 3n), tail)
  })
  ```

- `writeFromStream` (`fs/effects/node/module.f.ts:233-237`) — same policy,
  destructured and re-wrapped: `([r, v]) => r === 'error' ? pure(resultError(v)) : …`
- `fileCas.write`'s `createExclusive` step (`fs/cas/module.f.ts:214-217`) —
  `([c, e]) => c === 'error' ? pure(error(e)) : loop(…)`
- `casUpload` (`fs/cas/module.f.ts:280-283`) —
  `if (result[0] === 'error') { return pure(result) } return rm(src).step(…)`
- `readUtf8File` (`fs/effects/node/module.f.ts:94-96`) — the *pure* variant:
  `r[0] === 'ok' ? ok(utf8ToString(r[1])) : r`.

(Sites that map *both* branches into a new shape — e.g. the MCP handlers in
`fs/cas/mcp/module.f.ts:176-180` turning errors into `errorResult(…)` — are
genuine two-branch matches, not this pattern, and stay as they are.)

**2. The helper *shape* needs a convention.** JS/FS has no pipeline operator, so
helpers that take the effect as an argument — `helper(effect)(args)` — nest the
moment two policies chain: `a(b(c(…)))`. And `Effect` itself must not be
extended with new methods. The way out is to notice that `.step` already *is*
the pipeline: design helpers as **step adapters** — functions that return a
continuation `(t: T) => Effect<Q, R>` to be passed *into* `.step` — so
`.step(adapterA).step(adapterB)` chains flat, left-to-right, in evaluation
order, and `Effect` stays untouched.

### Proposal

Adopt the step-adapter shape as the house convention for effect helpers, and
add the two combinators the sites above need.

**`mapOk`** in `fs/types/result/module.f.ts` — the pure half, no effect
involved:

```ts
export const mapOk = <T, R>(f: (value: T) => R) => <E>(r: Result<T, E>): Result<R, E> =>
    r[0] === 'ok' ? ok(f(r[1])) : r
```

**`okStep`** in `fs/effects/module.f.ts` — the effectful short-circuit.
`Result` from `fs/types/result` is a types-layer import, so no cycle (same
layering note as [fold-stream-combinator](./fold-stream-combinator.md));
`IoResult<T>` is an alias of `Result<T, unknown>`, so `IoResult` call sites
type-check unchanged:

```ts
export const okStep =
    <T, E, O extends Operation, R>(f: (value: T) => Effect<O, Result<R, E>>) =>
    (r: Result<T, E>): Effect<O, Result<R, E>> =>
        r[0] === 'error' ? pure(r) : f(r[1])
```

Call sites collapse to one flat line each:

```ts
// writeLoop
writeBytes(path, offset, v).step(okStep(() => f(offset + Number(lenV >> 3n), tail)))
// casUpload
casAddFile(c)(src).step(okStep(v => rm(src).step(() => pure(ok(v)))))
// readUtf8File
readFile(path).step(r => pure(mapOk(utf8ToString)(r)))
```

A side benefit: several of these sites currently need explicit return-type
annotations (`(r): Effect<O | WriteBytes, IoResult<void>> =>`) because TS won't
unify the branch union on its own. The adapter pins that union once in its
signature, so the call-site annotations can be dropped.

### Tasks

- [ ] Add `mapOk` to `fs/types/result/module.f.ts` with proof coverage (both branches).
- [ ] Add `okStep` to `fs/effects/module.f.ts` with proof coverage (both branches).
- [ ] Convert the five listed sites; drop return-type annotations that become redundant.
- [ ] On close, capture the step-adapter convention (helpers are continuations
      for `.step`, never wrappers taking the effect) in the module JSDoc of
      `fs/effects/module.f.ts`.
- [ ] `npx tsc`, `fjs t`.

### Related

- [ornotfound-combinator](../node/todo/ornotfound-combinator.md) — the
  ENOENT-is-benign policy, reshaped to this same adapter form.
- [fold-stream-combinator](./fold-stream-combinator.md) — the stream-protocol
  sibling; its per-chunk step is a Kleisli function of the same shape.
