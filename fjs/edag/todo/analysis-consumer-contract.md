## analysis-consumer-contract. Every consumer of the analysis repeats its validation and re-derives what it knows

**Priority:** P4
**Status:** open

### Problem

`bindingError`'s doc says executable consumers call it once on the
complete graph, and each of them writes that obligation out:

```js
// fjs/fsc/serializer, trySerialize and again tryModuleSerialize
const a = analysis(e)
const problem = bindingError(a)
if (problem !== null) { return error(problem) }
// fjs/fsc/rust, bodyLines
const problem = bindingError(analysis(root))
// fjs/edag/memo, memo
const problem = bindingError(a); assert(problem === null, problem)
```

Two facts the analysis already holds are then re-derived by the
serializer: which operands a node has — its `operands` lists `'[]'`,
`'{}'`, `'.'`, `'-'`, `','` per tag with `default: []`, while the
analysis's private `refs` is the complete kind-driven answer — and
whether a node mints an identity, the serializer's `minting` against
the analysis's private `mergeable`. The serializer's `default: []` means
that once operators get a spelling, a shared container under `+` is
silently not hoisted.

### Proposal

The analysis exports its contract as a type, and its facts:

```ts
/** An `Analysis` that `bindingError` has passed; only `checked` makes one. */
export type Checked = Phantom<Analysis, 'checked'>
export const checked: (e: Exp) => Result<Checked, string>
export const refs: (node: Node) => readonly number[]
export const mintsIdentity: (node: Node) => boolean
```

`Checked` is nominal — `fjs/types/phantom` is how this repository brands
a type — so an unchecked `Analysis` does not pass where a `Checked` is
asked for. The three `fsc` sites call `checked` on their `Exp`. `memo`,
which takes an analysis rather than an expression, takes a `Checked`
and drops its assertion: the type says what the assertion said, and the
executor's contract is stronger, not weaker, since a caller can no
longer hand it an analysis nothing has checked. The serializer's
`hoists` walks `refs` and filters with `mintsIdentity`; `operands` and
`minting` go.

### Tasks

- [ ] `Checked`, `checked`, `refs` and `mintsIdentity` with proofs; the
      four consumers through them, `memo`'s signature on `Checked`.
- [ ] `tsc`, `fjs test`.

### Related

- [identity-shared-walks.md](./identity-shared-walks.md) — adds
  `identityShared` to the analysis for the same reason: a consumer was
  recomputing it.
- [../../fsc/serializer/todo/stage-a-operators.md](../../fsc/serializer/todo/stage-a-operators.md)
  — where `operands`'s `default: []` would first bite.
