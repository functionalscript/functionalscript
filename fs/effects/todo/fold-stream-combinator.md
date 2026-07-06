## fold-stream-combinator. `foldStream` combinator for `IoResult<Vec>` streams

**Priority:** P3
**Status:** open

### Problem

Every consumer of a `List<O, IoResult<Vec>>` re-hand-writes the same
three-case fold: *EOF → finalize; error item → propagate; chunk → fold and
recurse on the tail.* The skeleton currently appears four times:

`detectStream` (`fs/mime/module.f.ts:290-299`) — pure fold:

```ts
const loop = (s: DetectState) => (l: List<O, IoResult<Vec>>): Effect<O, IoResult<DetectMeta>> =>
    l.step((node): Effect<O, IoResult<DetectMeta>> => {
        if (node === undefined) { return pure(ok(finish(s))) }
        const { first, tail } = node
        const [t, v] = first
        if (t === 'error') { return pure(error(v)) }
        return loop(push(s)(v))(tail)
    })
```

`collectRead` (`fs/cas/mcp/module.f.ts:132-147`) — pure fold with an
overflow guard in the per-chunk step:

```ts
const loop = (acc: Vec) => (s: List<O, IoResult<Vec>>): Effect<O, IoResult<Vec>> =>
    s.step((node): Effect<O, IoResult<Vec>> => {
        if (node === undefined) { return pure(ok(acc)) }
        const { first, tail } = node
        const [t, v] = first
        if (t === 'error') { return pure(first) }
        if (bitVecLength(acc) + bitVecLength(v) > maxLength) { … }
        return loop(msb.concat(acc)(v))(tail)
    })
```

`writeLoop` (`fs/effects/node/module.f.ts:205-228`) and `fileCas.write`'s
inner `loop` (`fs/cas/module.f.ts:184-207`) are the same skeleton with an
*effectful* per-chunk step (`writeBytes` and `writeBytes` + hash + lease
renewal respectively).

The EOF/error/chunk control flow is an invariant of the stream protocol
(see [66o-read-streamfile-dedup](../../cas/todo/66o-read-streamfile-dedup.md)
for the producer side), yet it is maintained in four places that must stay
in sync.

### Proposal

Add a `foldStream` combinator to `fs/effects/list/module.f.ts` whose step
returns an `Effect`, so it subsumes both the pure folds (step = `pure(...)`)
and the effectful writers.

**Layering note:** `IoResult` cannot appear in this module's signature —
it is exported by `fs/effects/node/module.f.ts`, which already imports
`List` from `fs/effects/list/module.f.ts`, so importing it back would be
a cycle. But `IoResult<T>` is just an alias for `Result<T, unknown>` from
`fs/types/result` (a types-layer module `effects/list` can import freely),
so write the signature in terms of `Result` — call sites that hold
`IoResult` values type-check unchanged:

```ts
import type { Result } from '../../types/result/module.f.ts'

export const foldStream =
    <O extends Operation, A>(step: (acc: A) => (chunk: Vec) => Effect<O, Result<A, unknown>>) =>
    (init: A) =>
    (stream: List<O, Result<Vec, unknown>>): Effect<O, Result<A, unknown>> => …
```

(`Vec` from `fs/types/bit_vec` is likewise a types-layer import. If even
that is judged too specific for `effects/list`, generalize the element
type to a parameter `I` in place of `Vec` — the combinator never inspects
the chunks. Alternatively the helper can live in
`fs/effects/node/module.f.ts` next to the I/O types, but the `Result`
spelling keeps it in the layer where `List` is defined, which is
preferred.)

- EOF returns `pure(ok(acc))`; an error item returns `pure(first)`;
  a chunk runs `step(acc)(chunk)` and recurses on `ok`, short-circuits on
  `error`.
- `detectStream` becomes `foldStream(s => chunk => pure(ok(push(s)(chunk))))(detectInit)`
  followed by a final `finish` mapping; `collectRead` becomes a fold whose
  step checks the overflow bound and concats.
- `writeLoop` threads `offset` as the accumulator; its per-chunk step is
  `writeBytes` + the buffer-size check.
- `fileCas.write` threads `{ state, offset, curPath }`; whether its EOF
  action (`publish`) fits the `ok(acc)` shape needs verification — if not,
  a variant taking an explicit `onDone: (acc: A) => Effect<O, IoResult<R>>`
  is acceptable, but prefer the smaller signature if all four consumers fit.

Exact signature (curried vs. tupled, `IoResult` in the step result vs. a
separate short-circuit channel) should be settled by converting the two pure
consumers first; the writers follow only if the shape stays clean.

### Tasks

- [ ] Add `foldStream` to `fs/effects/list/module.f.ts` with proof coverage.
- [ ] Convert `detectStream` (`fs/mime`) and `collectRead` (`fs/cas/mcp`).
- [ ] Convert `writeLoop` (`fs/effects/node`) if the effectful step fits
      without contortion; otherwise document why in this issue and keep it.
- [ ] Evaluate `fileCas.write`'s loop; convert or document why not.
- [ ] Run `npx tsc` and `fjs t`.

### Related

- [66o-read-streamfile-dedup](../../cas/todo/66o-read-streamfile-dedup.md) —
  producer-side dedup of the same stream protocol.
- [abstract-write](../../cas/todo/abstract-write.md) — writer-pair
  abstraction; `foldStream` is the consumer-side generalization.
- [allreduce-combinator](./allreduce-combinator.md) — sibling combinator for
  parallel effects.
- [step-adapters](./step-adapters.md) — the step-adapter helper shape; this
  combinator's per-chunk step is a Kleisli function of the same shape.
- [write-closed-helpers](../../cas/todo/write-closed-helpers.md) — hoists
  `fileCas.write`'s remaining nested helpers; its loop conversion depends on
  this issue.
