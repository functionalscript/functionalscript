## The facts the IR's stages share, exported once

**Priority:** P3
**Status:** open

### Problem

The [README](../README.md) gives [`module.f.js`](../module.f.js) "the
constructors, and the facts about types that the stages share". Several
such facts are instead private to each stage that needs them, copied:

- **A sealed type's definition.** `defIn` in
  [`lifetime`](../lifetime/module.f.js) and `definition` in
  [`wasm`](../wasm/module.f.js) are the same expression,

  ```js
  assertNotNullish(assertNotNullish(at(module)(imports)).types.find(([k]) => k === name))[1]
  ```

  [`check/owned`](../check/owned/module.f.js) writes it inline in
  `holds`, and so does `linear` in [`inline`](../inline/module.f.js);
  [`check`](../check/module.f.js) has the `Result` form.
- **A callee's signature.** `signatureOf` in `lifetime` and the opening
  of `callTerm` in `check/owned` are identical — `self` from the
  module's functions, anything else from the interface's.
- **Whether a type holds a counted value**: `holds` in `check/owned`,
  `counted` and `holds` in `lifetime`.
- **Name sets as lists.** `minus`, `union` and `nothing` are verbatim in
  `check/owned` and in `lifetime`; `check` has a third `union`.
- **`isFloat`** in `check` and in [`from_fast`](../from_fast/module.f.js),
  and inline in `wasm`.
- **`count`**, ``(k, noun) => k === 1 ? `one ${noun}` : `${k} ${noun}s` ``,
  in `check` and in `from_fast`, comment included.
- **The test for `never`**: `isNever` in `check`, `completes` in
  `lifetime`, `afterNever` in `wasm`, `equal(type, never)` inline in
  `check/owned`.
- **A callee's printed name**, ``module === 'self' ? name : `${module}.${name}` ``,
  in `check`, in `check/owned` and as `callee` in
  [`print`](../print/module.f.js).

Each is a statement about the IR, not about a stage. The checker has
accepted the module by the time the later stages run, which is why their
copies assert where the checker's answers a `Result`; that split is real
and stays.

### Proposal

`fjs/ir/module.f.js` exports `definitionOf(imports, t)`,
`signatureOf(functions, imports, module, name)`, `holds(imports)(t)`,
`isFloat`, `isNever` and `calleeName`, the asserting forms, for every
stage after the checker. `minus` and `union` go beside `dedup` in
`fjs/types/array`, as the order-keeping set operations on a list.

### Drawbacks

- `fjs/types/string_set` is no substitute for the two set operations: it
  sorts, and the order of these lists shows — the lifetime pass writes
  its drops in list order.
- Few lines go. Each helper goes from several definitions to one,
  which is the point.
- Each export needs its cases in [`proof.f.js`](../proof.f.js), where
  today the stages' proofs reach them indirectly.
