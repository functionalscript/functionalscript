## Generate the Rust EDAG types and validation from the schema

**Priority:** P4
**Status:** on-hold — part of the optional Rust EDAG work, outside MVP and
self-hosting prerequisites.

### Problem

The EDAG's shape is defined once, as the RTTI schema in
[`../module.f.mjs`](../module.f.mjs), with [`../types.ts`](../types.ts) pinned
against it — the specification of record ([`../README.md`](../README.md)). The
optional [Rust EDAG library](../../../todo/rust-edag.md) would need types and
validation for the same data. Written by hand, those would be a second
definition of the schema, free to drift from the first. The direct Rust backend
and the planned AOT-compiled FJS interpreter do not need those native types.

[`../rust/module.f.mjs`](../rust/module.f.mjs) does not close this: it prints
EDAG *values* as Rust expressions — the operator corpus and the `.rs` output
of `fjs compile` — and generates no Rust *types* or validation from a schema.

### Proposal

When the Rust EDAG work resumes, use a Rust printer over RTTI schemas, following
the TypeScript printer in [`fjs/rtti/ts`](../../rtti/ts/README.md). Generate the
EDAG types and validation of the `Any` shape its optional native executor accepts
from `../module.f.mjs`. Commit the output and keep it in step through the
`npm run gen` drift check. Later operations are added to the schema without
changing existing canonical forms, and the generated Rust follows.

Keep generated EDAG types in the optional library, with no dependency from
the VM foundation. The effect runner's schema/stub generation is separately
tracked in [nanvm-effects-node](../../../todo/nanvm-effects-node.md); shared
RTTI printing machinery may be reused without making either consumer depend
on the other.

### Tasks

- [ ] A Rust printer for RTTI schemas, in the pattern of `fjs/rtti/ts`.
- [ ] Generate the optional Rust EDAG library's types and input
      validation from `../module.f.mjs`; commit the output under
      `npm run gen`.
- [ ] Prove the generated validation against the shared conformance vectors
      ([corpus-as-conformance-vectors](../../nanvm/todo/corpus-as-conformance-vectors.md)).

### Related

- [`../README.md`](../README.md) — the schema of record and the module
  boundary: `fjs/edag` imports nothing from its producers and executors.
- [`fjs/rtti/ts/README.md`](../../rtti/ts/README.md) — the TypeScript printer
  this follows.
- [rust-edag](../../../todo/rust-edag.md) — the deferred consumer of these types.
- [mvp-roadmap](../../../nanvm-lib/todo/mvp-roadmap.md) — direct AOT and FJS
  self-hosting proceed without this native representation.
- [corpus-as-conformance-vectors](../../nanvm/todo/corpus-as-conformance-vectors.md)
  — the conformance examples shared by the FunctionalScript and Rust sides.
- [callable-function-objects](../../../nanvm-lib/todo/callable-function-objects.md)
  — Stage 7's semantic EDAG association is independent of a Rust executor.
- [`spec/todo/serialization.md`](../../../spec/todo/serialization.md) — the
  EDAG-as-data decision and the two execution paths.
