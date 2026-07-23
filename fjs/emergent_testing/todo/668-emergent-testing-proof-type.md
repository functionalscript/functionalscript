## 668-emergent-testing-proof-type. Add an explicit `Proof` type

**Priority:** P3
**Status:** open

### Problem

Emergent testing documentation describes proofs as ordinary values, but the code
does not expose a named `Proof` type for modules to use. This makes the expected
recursive shape implicit in runner code and prose instead of available as a
type-level contract.

### Proposal

Add and export a `Proof` type near the emergent testing runner API. The type
should model the recursive proof tree accepted by the runner:

```ts
export type Proof =
    | Readonly<Record<string, Proof>>
    | readonly Proof[]
    | (() => Proof | undefined)
```

Confirm whether returning a nested `Proof` from a function is intended runner
behaviour. If proof functions are only test leaves today, use a narrower
function branch and document the choice in JSDoc.

An alternative is to define the proof shape as RTTI and derive the TypeScript
type from it. That would keep runtime validation and the public type in sync,
but proof leaves are functions, so this requires extern RTTI support for
function values before it can model the full proof tree.

### Tasks

- [ ] Decide whether `Proof` should be a direct TypeScript type or derived from
  RTTI.
- [ ] Add the `Proof` type in the natural emergent testing module.
- [ ] Use the type in runner/registering APIs where it reflects existing
  behaviour.
- [ ] Document proof-tree invariants in JSDoc and keep the README definition in
  sync.
- [ ] Add or update proof coverage for accepted object, array, and function
  proof shapes.

### Related

- [i65Z-tf-test-tree-walker](todo.md) — planned shared
  proof-tree traversal.
- [i668-rtti-function-types](../types/todo.md) — extern RTTI for
  function-valued proof leaves.
- [i665-proof-property-tests](todo.md) — future proof
  shape extension.
