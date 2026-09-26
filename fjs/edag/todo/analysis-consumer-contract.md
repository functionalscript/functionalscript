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
/** `a` where `bindingError` finds nothing; its message where it does. */
export const checked: (a: Analysis) => Result<Analysis, string>
export const refs: (node: Node) => readonly number[]
export const mintsIdentity: (node: Node) => boolean
```

`checked` takes an analysis, not an expression, so every consumer can
call it: the three `fsc` sites write `checked(analysis(e))` and branch
on the result, and `memo` asserts on it. `memo`'s runtime check stays
— an executor refusing a graph nothing has checked is a contract worth
keeping, and a type cannot carry it: `Phantom` is structural, its marker
optional, so a plain `Analysis` would pass as a `Checked` — but the
check is now spelled once, in `checked`, and `memo`'s line is a call to
it rather than a copy of it. The serializer's `hoists` walks `refs` and
filters with `mintsIdentity`; `operands` and `minting` go.

### Tasks

- [ ] `checked`, `refs` and `mintsIdentity` with proofs; the four
      consumers through them, `memo` asserting on `checked`'s result.
- [ ] `tsc`, `fjs test`.

### Related

- [identity-shared-walks.md](./identity-shared-walks.md) — adds
  `identityShared` to the analysis for the same reason: a consumer was
  recomputing it.
- [../../fsc/serializer/todo/stage-a-operators.md](../../fsc/serializer/todo/stage-a-operators.md)
  — where `operands`'s `default: []` would first bite.
