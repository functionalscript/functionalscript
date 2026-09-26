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

The analysis exports its contract and its facts:

```ts
export const checked: (e: Exp) => Result<Analysis, string>   // analysis plus bindingError
export const refs: (node: Node) => readonly number[]
export const mintsIdentity: (node: Node) => boolean
```

The four sites call `checked`; the serializer's `hoists` walks `refs`
and filters with `mintsIdentity`; `operands` and `minting` go.

### Tasks

- [ ] The three exports with proofs; the consumers through them.
- [ ] `tsc`, `fjs test`.

### Related

- [identity-shared-walks.md](./identity-shared-walks.md) — adds
  `identityShared` to the analysis for the same reason: a consumer was
  recomputing it.
- [../../fsc/serializer/todo/stage-a-operators.md](../../fsc/serializer/todo/stage-a-operators.md)
  — where `operands`'s `default: []` would first bite.
