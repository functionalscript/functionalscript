## The adapter exports a surface only its proof calls

**Priority:** P4
**Status:** open

### Problem

The [README](../README.md) says this module is "the entry from an EDAG into
the Rust writer" and that how each construct is spelled in Rust lives in
`fjs/rust/serializer`. Yet [`module.f.mjs`](../module.f.mjs) re-exports the
serializer's spelling tables verbatim — `braced`, `op1Rust`, `op2Rust`,
`op3Rust`, `useLines`, `useLinesTagged` — and offers a composition of its
private `converted` with each serializer call: `expExprTagged`, `expExpr`,
`nodeExpr`, `helperExpr`, `scopeTagged`, `scope`, `statementsOf`,
`bindingLine`, plus `restLine`, `readsFrame` and `readsSelf`.

At `ad3fb2dc`, outside proofs, `helperExpr`, `restLine`, `readsFrame`,
`readsSelf`, `expExprTagged`, `scope`, the three `opNRust` re-exports and
`useLines` have no consumer; `nodeExpr` is shadowed by
[`fjs/nanvm/rust`](../../../nanvm/rust/module.f.mjs)'s own `nodeExpr`. The
real consumers are `fjs/nanvm/rust` (`bindingLine`, `braced`, `expExpr`,
`needsRuntime`, `statementsOf`) and `fjs/compiler/rust` with its `runtime`
(`scopeTagged`, `holdsFunction`, `needsRuntime`, `readsArgs`,
`useLinesTagged`).

### Proposal

Keep `converted`'s real entry points — `expExpr`, `scopeTagged`,
`statementsOf`, `bindingLine`, and the predicates `holdsFunction`,
`needsRuntime`, `readsArgs` — and delete the rest with the serializer
re-exports; `nanvm/rust` and `compiler/rust/runtime` import `braced` and
`useLinesTagged` from `fjs/rust/serializer` directly, as the README says.
Optionally collapse the compositions to one `converted`-returning export with
the serializer calls at the two call sites.

### Tasks

- [ ] Delete the unused exports, the forwarding constants and their proof
      entries; re-point the two importers.
- [ ] Drop `nanvm/rust`'s duplicate `nodeExpr` if `expExpr` serves it.

### Related

- [`fjs/todo/compiler-layer-upward-imports`](../../../todo/compiler-layer-upward-imports.md)
  — the sibling shim in `compiler/serializer/function_text`.
