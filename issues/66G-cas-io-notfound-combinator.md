# 66G-cas-io-notfound-combinator. `effects/node`: lift the "swallow `ENOENT`, surface real errors" policy into one combinator

**Priority:** P4
**Status:** open

## Problem

`fs/cas/module.f.ts` decodes an `IoResult<T>` in two places with the *same*
three-way policy: continue with the `ok` value, treat a missing path
(`isNotFound`) as a benign default, and rethrow every other error. The two
sites spell that policy out by hand.

```ts
// fs/cas/module.f.ts:51-57 — read
readFile(toPath(key)).step(r => {
    if (r[0] === 'ok') { return pure(r[1]) }
    // A missing file means "no such content"; surface anything else.
    if (isNotFound(r[1])) { return pure(undefined) }
    throw r[1]
}),
```

```ts
// fs/cas/module.f.ts:67-82 — list
access('.cas').step(a => {
    if (a[0] === 'error') {
        if (isNotFound(a[1])) { return pure([] as readonly Vec[]) }
        throw a[1]
    }
    return readdir('.cas', { recursive: true })
        .step(r => pure(unwrap(r).flatMap(/* … */)))
}),
```

Strip the domain-specific parts (`readFile` vs `access`, the `undefined` vs
`[]` default, and what runs on success) and what is left is identical in both:
`ok → onOk(value)`, `error && isNotFound → default`, `error → throw`. The
`isNotFound` helper already lives in `fs/effects/node/module.f.ts` precisely so
"callers can swallow only the missing-path case while propagating genuine
failures" (its JSDoc) — but the *act* of swallowing is re-implemented at every
call instead of living next to the predicate.

## Proposal

Add one combinator beside `isNotFound` in `fs/effects/node/module.f.ts`:

```ts
/**
 * Runs an `IoResult`-returning effect under the missing-path policy: when the
 * result is `ok`, continues through `onOk`; when the error is a missing path
 * (`isNotFound` / `ENOENT`), substitutes the `notFound` default; any other
 * error is rethrown. Centralizes the "swallow the missing-path case, surface
 * genuine failures" rule that filesystem callers otherwise re-spell at each
 * site.
 *
 * The probe effect's operations (`O`) and the success continuation's
 * operations (`Q`) are independent and unioned in the result, so the success
 * branch may perform *different* operations than the probe — e.g. `access`
 * then `readdir`. The default's type (`N`) is also independent of `onOk`'s
 * result (`R`); the result is `R | N`, which is what lets `read` map `ok` to a
 * `Vec` while defaulting to `undefined`.
 */
export const orNotFound =
    <O extends Operation, T>(effect: Effect<O, IoResult<T>>) =>
    <N>(notFound: N) =>
    <Q extends Operation, R>(onOk: (value: T) => Effect<Q, R>): Effect<O | Q, R | N> =>
        effect.step<Q, R | N>(r => {
            if (r[0] === 'ok') { return onOk(r[1]) }
            if (isNotFound(r[1])) { return pure(notFound) }
            throw r[1]
        })
```

The two CAS sites then carry only their differences:

```ts
read: (key: Vec): Effect<FileKvStoreOperation, Vec | undefined> =>
    orNotFound(readFile(toPath(key)))(undefined)(pure),

list: (): Effect<FileKvStoreOperation, readonly Vec[]> =>
    orNotFound(access('.cas'))<readonly Vec[]>([])(() =>
        readdir('.cas', { recursive: true }).step(r =>
            pure(unwrap(r).flatMap(({ name, parentPath, isFile }) =>
                toOption(isFile
                    ? cBase32ToVec(parentPath.substring(prefix.length).replaceAll('/', '') + name)
                    : null))))),
```

`read` passes `pure` directly as `onOk` (the `ok` value is the result, the
default is `undefined`, and `T` is inferred from `readFile` so `pure` needs no
annotation); `list` ignores the `void` from `access` and runs the directory
walk. The `<readonly Vec[]>` argument on `list` pins the empty-array default's
type per the AGENTS.md literal-typing rule (`[]` would otherwise infer
`never[]`), so no `as const` is needed.

The three-stage currying (`effect → notFound → onOk`) is deliberate: `T` is
fixed by the probe effect first, so `onOk` (and a bare `pure`) infer cleanly;
the result type is `Effect<O | Q, R | N>`. This shape was type-checked against
a model of the `Effect`/`step`/`pure` signatures (`step<Q, R | N>` must be
annotated explicitly, because the `ok` and `notFound` branches return different
`Effect` instantiations that TypeScript will not unify on its own when `R`/`N`
are still free).

## Tasks

- [ ] Add `orNotFound` to `fs/effects/node/module.f.ts` (it already exports
      `isNotFound`, `pure`, `Effect`, `Operation`, `IoResult`).
- [ ] Rewrite `read` and `list` in `fs/cas/module.f.ts` to use it; drop the
      now-redundant inline comments (the policy is documented once on the
      combinator).
- [ ] Extend `fs/effects/node/proof.f.ts` (or the nearest existing proof) to
      cover all three branches of `orNotFound`: `ok`, `ENOENT`, and a
      non-`ENOENT` error (the throw path), keeping 100% proof coverage.

## Why this qualifies

- **DRY** — two real consumers exist today (the AGENTS.md "second consumer"
  bar is met), and both are the three-way `IoResult` decode, not a coincidental
  shape. A third filesystem-backed store or a future `delete`/`stat` op that
  tolerates a missing path would otherwise copy the same block again.
- **Separation of concerns** — "which errors are benign and which propagate"
  is an `effects/node` policy, the same concern `isNotFound` already lives for.
  CAS should express *what* its default is, not *how* to inspect an `IoResult`
  for `ENOENT`. Today that knowledge is duplicated into the storage layer.
- **Readability** — the success logic (`list`'s directory walk) stops being
  buried inside an error-handling `if` ladder; each site reads as
  "default `X`, on success do `Y`".

## Caveats / why this is an idea, not a mechanical edit

- **`throw` in `.f.ts`.** Both current sites already `throw` on a non-`ENOENT`
  error; the combinator preserves that behaviour exactly (it does not turn the
  error back into a `Result`). It moves the side effect into one place rather
  than introducing a new one. If the project later prefers surfacing the error
  through the effect channel instead of `throw`, that is a separate change and
  this combinator is the single place to make it.
- **Currying order / operation sets.** An earlier draft used a single `O` for
  both the probe and the success handler and applied the effect last; that does
  not type-check — `list` probes with `access` (`Access`) but its success
  branch runs `readdir` (`Readdir`), so the two operation sets must be separate
  type parameters (`O` and `Q`) and unioned in the result. The signature above
  reflects that fix. An uncurried `(effect, notFound, onOk)` form is also
  viable; the win is one definition either way.
- **Scope.** Only `read` and `list` apply. `write` (line 58) does not decode an
  `IoResult` this way, and the CLI/MCP layers use `unwrap`/`errorExit` for a
  different (fail-loud) policy — leave those untouched.

## Related

- [i208](./208-try-catch-consolidate.md) — consolidating the `tryCatch`
  helpers that *produce* `IoResult`; this issue is about *consuming* one
  uniformly. Complementary, not overlapping.
- [i66D-mcp-validate-response-envelope](./66D-mcp-validate-response-envelope.md)
  — same spirit (collapse a repeated validate/branch envelope) one layer up in
  the MCP request handler.
