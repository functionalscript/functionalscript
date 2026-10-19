## Carrying an effect's `Result` as its value, and "is the path there"

**Priority:** P3
**Status:** open

### Problem

The [README](../README.md) names three branch-aware operations: `step`,
`catchStep`, `resultStep`. A fourth shape is in use and has no name: run `e`
and continue with its whole `Result` as the success value, so the chain goes
on either way and the caller decides later. It is spelled by hand at every
site:

```js
resultStep(readUtf8File(path), read => pureOk(read))                        // website readModule
const foundAt = path => resultStep(access(path), found => pureOk(found))    // website
resultStep(import_(source), loaded => pureOk(loaded))                       // emergent_testing/browser loadOne
resultMapStep(result(t, sr, set.throws), ok)                                // emergent_testing runEntries
```

`resultMapStep(e, ok)` is the shortest spelling and the one that explains
the rest; a reader meets a spelling per site and checks each for a
difference that is not there. One site that looks the same is not one:
`attempt` in [`fjs/emergent_testing/browser`](../../emergent_testing/browser/module.f.mjs),
`resultStep(catch_(f), r => pureOk(r[0] === 'ok' ? r[1] : error(r[1])))`,
wraps `catch_`, which already answers a `Result` as its value and never
fails, so it is `catch_(f)` under a narrowed type, as its doc says, and not
a `Result` carried. `attemptStep` over it would add a second `ok` layer, and
it stays as it is.

One instance of the shape has a policy of its own and is decided at every
site, with differing answers. "Is `path` there" is `access` read as a value: `ENOENT` is
the answer `false`, any other failure is the failure it is. `foundAt` plus
`isNotFound` in [`fjs/website`](../../website/module.f.mjs) and `list` in
[`fjs/cas`](../../cas/module.f.mjs) say so. `ci` in
[`fjs/ci`](../../ci/module.f.mjs) reads `result[0] === 'ok'`, so a
`Cargo.toml` that is there but unreadable — a permission error — generates a
workflow without the Rust jobs, silently: the plausible wrong answer
[DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
forbids.

### Proposal

In [`module.f.mjs`](../module.f.mjs), beside `resultStep`:

```ts
export const attemptStep: <O, T, E>(e: Effect<O, T, E>) => Effect<O, Result<T, E>, never>
    = e => resultMapStep(e, ok)
```

documented in the README's table as the "both branches, as a value" form;
the sites above use it. In [`node/module.f.mjs`](../node/module.f.mjs):

```ts
export const exists: (path: string) => Effect<Access, boolean, IoChannel>
```

`true` on `ok`, `false` on `ENOENT`, the error on anything else. `foundAt`'s
callers in `website`, `cas.list` and `ci` read `step(exists(p), has => …)`,
and `ci` stops swallowing what is not a missing file.

### Tasks

- [ ] `attemptStep` with its proof and README row; `website`,
      `emergent_testing` and its browser runner import it.
- [ ] `exists` with its proof; `website`, `cas` and `ci` import it.
- [ ] A `ci` proof for an `access` failure that is not `ENOENT`.

### Related

- [allvoid-combinator](./allvoid-combinator.md),
  [allreduce-combinator](./allreduce-combinator.md) — the other missing
  combinators, found the same way.
- [command-output](../../todo/command-output.md) — `ci`'s output policy; this
  is its input.
