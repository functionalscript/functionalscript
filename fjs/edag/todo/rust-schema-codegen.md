## Generate the Rust EDAG types and validation from the schema

**Priority:** P2
**Status:** open

### Problem

The EDAG's shape is defined once, as the RTTI schema in
[`../module.f.mjs`](../module.f.mjs), with [`../types.ts`](../types.ts) pinned
against it — the specification of record ([`../README.md`](../README.md)). The
Rust side has no counterpart. `nanvm-lib`'s `Function` constructor accepts an
`Any` that describes code, and must validate its shape and build the EDAG
types from it; written by hand, those Rust types and that validation would be
a second definition of the schema, free to drift from the first.

[`../rust/module.f.mjs`](../rust/module.f.mjs) does not close this: it prints
EDAG *values* as Rust expressions — the operator corpus and the `.rs` output
of `fjs compile` — and generates no Rust *types* or validation from a schema.

### Proposal

A Rust printer over RTTI schemas, following the TypeScript printer in
[`fjs/rtti/ts`](../../rtti/ts/README.md): the EDAG types and the validation
of the `Any` shape the `Function` constructor accepts are generated from
`../module.f.mjs`, committed, and kept in step by the `npm run gen` drift
check. Later operations are added to the schema without changing existing
canonical forms, and the generated Rust follows.

### Tasks

- [ ] A Rust printer for RTTI schemas, in the pattern of `fjs/rtti/ts`.
- [ ] Generate the EDAG types and the `Function` constructor's input
      validation from `../module.f.mjs`; commit the output under
      `npm run gen`.
- [ ] Prove the generated validation against the shared conformance vectors
      ([corpus-as-conformance-vectors](../../nanvm/todo/corpus-as-conformance-vectors.md)).

### Related

- [`../README.md`](../README.md) — the schema of record and the module
  boundary: `fjs/edag` imports nothing from its producers and executors.
- [`fjs/rtti/ts/README.md`](../../rtti/ts/README.md) — the TypeScript printer
  this follows.
- [mvp-roadmap](../../../nanvm-lib/todo/mvp-roadmap.md) — the P2 "EDAG spec"
  and `Function` constructor items this feeds.
- [corpus-as-conformance-vectors](../../nanvm/todo/corpus-as-conformance-vectors.md)
  — the conformance examples shared by the FunctionalScript and Rust sides.
- [callable-function-objects](../../../nanvm-lib/todo/callable-function-objects.md)
  — Stage 7, EDAG embedding on natively compiled functions.
- [`spec/todo/serialization.md`](../../../spec/todo/serialization.md) — the
  EDAG-as-data decision and the two execution paths.
