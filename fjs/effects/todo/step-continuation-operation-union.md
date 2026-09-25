## `step` continuations widen their operation union with a cast

**Priority:** P3
**Status:** open

### Problem

`step` is typed

```
<O extends Operation, T, E, Q extends Operation, R, F>(e: Effect<O, T, E>, f: (t: T) => Effect<Q, R, F>) => Effect<O | Q, R, E | F>
```

so a continuation may introduce operations of its own and the result carries the
union. When this was filed, six call sites cast the continuation — or its
result — to the union the caller wants, because inference landed on a narrower
or differently shaped `Q`.

**Re-measured at `36c8d4a`, the continuation casts are gone.** None of the
listed sites — `Evo.add` in `fjs/cas/evo`, the `Rm` continuation in `fjs/cas`,
`_CompileOp` in `fjs/fsc`, `ParseContext` in `fjs/fsc/transpiler`, and the
`Result<number, string>` continuation in `fjs/effects/proof.f.mjs` — carries a
cast any more. One cast of the listed shape survives, and it is not a
continuation:
`registerSelectsContextAndStar` in `fjs/emergent_testing/proof.f.mjs` casts a
whole `register(…)` effect to
`Effect<_RegisterMockOps | Readdir | Import, 0, number>`, and
`reporterWriteFailure` beside it casts `main(…)` to `Effect<_FailOps, 0, number>`.
Both narrow a program's operation set to what a mock runner handles, rather than
widening a continuation's.

A branch returning `pure(error(…))` infers `Effect<never, Error<string>>`, and a
branch returning an effect infers its own operation set; the two do not join to
the declared union without help. `step`'s own body shows the same shape.

Each cast is an override, not a check: if a continuation ever gains an operation
the runner cannot interpret, the cast hides it and the failure surfaces as a
missing handler at run time.

### Proposal

Work out whether this is inference losing the contextual type, or `step`'s
signature being unable to express "at least these operations". If the former, a
contextual annotation on the continuation parameter may be enough; if the
latter, `step` needs a way to name the target union. Either way the six sites
should end up checked rather than cast.

### Tasks

- [ ] Decide whether the two surviving proof casts are this issue's shape; if
      not, close this issue and file them where the mock runner's typing is
      tracked.

### Related

- [`todo/inline-type-casts.md`](../../../todo/inline-type-casts.md)
