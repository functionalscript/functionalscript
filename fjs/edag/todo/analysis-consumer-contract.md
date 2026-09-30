## analysis-consumer-contract. Every consumer of the analysis repeats its validation and re-derives what it knows

**Priority:** P4
**Status:** open

### Problem

`bindingError`'s doc says executable consumers call it once on the
complete graph, and each of them writes that obligation out:

```js
// fjs/compiler/serializer, trySerialize and again tryModuleSerialize
const a = analysis(e)
const problem = bindingError(a)
if (problem !== null) { return error(problem) }
// fjs/compiler/rust, bodyLines
const problem = bindingError(analysis(root))
// fjs/edag/memo, memo
const problem = bindingError(a); assert(problem === null, problem)
```

Two facts the analysis already holds are then re-derived by the
serializer: which operands a node has — its `operands` lists `'[]'`,
`'{}'`, `'.'`, `'-'`, `','` per tag with `default: []`, while the
analysis's private `refs` is the complete kind-driven answer — and
which nodes mint an identity, the serializer's `minting` beside the
analysis's private `mergeable`. Those two are not one predicate:
`minting` answers `[]`, `{}` and `=>`, the nodes a hoisted `const` may
name; `mergeable` also refuses to merge `()`, `?.()` and a calling
chain, because two calls written separately must run separately. A
call is therefore not mergeable and not minting, and `!mergeable` is
not `minting`. The serializer's `default: []` means
that once operators get a spelling, a shared container under `+` is
silently not hoisted.

### Proposal

The analysis exports its contract and its facts:

```ts
/** `a` where `bindingError` finds nothing; its message where it does. */
export const checked: (a: Analysis) => Result<Analysis, string>
export const refs: (node: Node) => readonly number[]
/** Whether a node's result is a fresh identity a `const` may name: `[]`, `{}`, `=>`. */
export const mintsIdentity: (node: Node) => boolean
```

`mintsIdentity` is the serializer's `minting` moved to the owner of
the node kinds, not `mergeable` renamed: it answers the three minting
kinds and nothing else, so a shared call is not hoisted and runs where
it is written, as today. `mergeable` stays private to the analysis, as
the merging rule it is, and the two are documented as the two
different facts they are.

`checked` takes an analysis, not an expression, so every consumer can
call it: the three compiler sites write `checked(analysis(e))` and branch
on the result, and `memo` asserts on it. `memo`'s runtime check stays
— an executor refusing a graph nothing has checked is a contract worth
keeping, and a type cannot carry it: `Phantom` is structural, its marker
optional, so a plain `Analysis` would pass as a `Checked` — but the
check is now spelled once, in `checked`, and `memo`'s line is a call to
it rather than a copy of it.

The serializer's `hoists` walks `refs` filtered by scope: the analysis
records the scope of every node, and a reference is followed only where
its node's scope is the one being written. That is the function-body
boundary `operands` keeps by answering nothing for `=>` — a shared
container inside a body belongs to the body's scope and is hoisted
there, never into the enclosing module — and the analysis states it as
data rather than as an omitted `case`. A function's slots keep their
separate handling: they are the `=>` entry's own array operand, which
`hoists` reads directly. Then `mintsIdentity` filters, and
`operands` and `minting` go.

### Tasks

- [ ] `checked`, `refs` and `mintsIdentity` with proofs; the four
      consumers through them, `memo` asserting on `checked`'s result.
- [ ] `tsc`, `fjs test`.

### Related

- [identity-shared-walks.md](./identity-shared-walks.md) — adds
  `identityShared` to the analysis for the same reason: a consumer was
  recomputing it.
- [../../compiler/serializer/module.f.mjs](../../compiler/serializer/module.f.mjs)'s
  `operands`, whose `default: []` is where a node kind the writer does not
  walk would first bite.
