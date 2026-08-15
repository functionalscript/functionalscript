# `step` continuations widen their operation union with a cast

**Priority:** P3
**Status:** open

### Problem

`step` is typed

```
<O extends Operation, T, Q extends Operation, R>(e: Effect<O, T>, f: (t: T) => Effect<Q, R>) => Effect<O | Q, R>
```

so a continuation may introduce operations of its own and the result carries the
union. In practice six call sites cast the continuation — or its result — to the
union the caller wants, because inference lands on a narrower or differently
shaped `Q`:

| Site | Cast |
| --- | --- |
| `fjs/cas/evo/module.f.mjs:456` | `Effect<MemOp, Result<Hash, string>>` around `pure(error(…))` |
| `fjs/cas/module.f.mjs:348` | `(v: Vec) => Effect<Rm, IoResult<Vec>>` |
| `fjs/djs/module.f.mjs:41` | `(result: Result<Unknown, ParseError>) => Effect<_CompileOp, number>` |
| `fjs/djs/transpiler/module.f.mjs:103` | `(context: ParseContext) => Effect<ReadFile, Result<Unknown, ParseError>>` |
| `fjs/effects/proof.f.mjs:85` | `(value: number) => Effect<never, Result<number, string>>` |
| `fjs/emergent_testing/proof.f.mjs:448` | `Effect<_RegisterMockOps \| Readdir \| Import, number>` |

A branch returning `pure(error(…))` infers `Effect<never, Error<string>>`, and a
branch returning an effect infers its own operation set; the two do not join to
the declared union without help. The `okStep` wrapper shows the same shape.

Each cast is an override, not a check: if a continuation ever gains an operation
the runner cannot interpret, the cast hides it and the failure surfaces as a
missing handler at run time.

### Proposal

Work out whether this is inference losing the contextual type, or `step`'s
signature being unable to express "at least these operations". If the former, a
contextual annotation on the continuation parameter may be enough; if the
latter, `step` needs a way to name the target union. Either way the six sites
should end up checked rather than cast.

### Related

- [`todo/inline-type-casts.md`](../../../todo/inline-type-casts.md)
