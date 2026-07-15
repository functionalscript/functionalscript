## AST spec

**Priority:** P1
**Status:** open

### Problem

The MVP pipeline ([mvp-roadmap](../nanvm-lib/todo/mvp-roadmap.md)) has three
components that must agree on one AST schema (tags and shapes): the parser
(P1, FJS), the AST serializer (P2, FJS), and the AST deserializer (P1, Rust).
The tag tables in [`lang/README.md`](./lang/README.md) sketch serialization
tags, but there is no single specification of record, so the three
implementations have nothing precise to be checked against.

The AST is the stable, canonical, serializable representation of functions
(see [`lang/README.md` §9](./lang/README.md#9-serialization-ast-not-bytecode)):
it will be used to compute content hashes (CAVM) and to transform back to
source code in `toString(f)`. Both uses require the schema to be exact —
one AST, one byte sequence, one hash.

### Proposal

Define the AST with **RTTI** ([`fs/types/rtti`](../fs/types/rtti/README.md)):
an RTTI schema (an FJS module) is the specification of record, and Rust code
for the AST types and the deserializer is **generated** from it.

Why RTTI:

- Single source of truth: the FJS side gets the TypeScript types (`Ts<T>`),
  `validate`, and `parse` directly from the schema; the Rust side gets
  generated types and deserialization code from the same schema.
- Precedent: [`fs/types/rtti/ts`](../fs/types/rtti/ts/README.md) already
  prints schemas as TypeScript types; the Rust generator follows the same
  pattern with a Rust printer.
- RTTI already supports the shapes an AST needs: structs, tuples, `or`
  (unions), and recursion via `Thunk`.

The tag tables in [`lang/README.md`](./lang/README.md) become derived
documentation; the RTTI schema is normative.

### Tasks

- [ ] Define the AST schema as an RTTI schema (FJS module) covering all MVP
      nodes: JSON level (§1), DJS level (§2: `const_ref`, `bigint`,
      operators, …), FJS level (§3: function, parameters, captured consts).
- [ ] Implement a Rust code generator from RTTI schemas: AST types +
      deserializing (following the pattern of the TypeScript printer in
      [`fs/types/rtti/ts`](../fs/types/rtti/ts/README.md)).
- [ ] Define the CBOR mapping of RTTI-described values, including the
      deterministic profile (see the open question in
      [mvp-roadmap](../nanvm-lib/todo/mvp-roadmap.md#open-questions)).
- [ ] Provide conformance examples (test vectors) shared by the FJS and Rust
      implementations.

### Related

- [nanvm-lib/todo/mvp-roadmap.md](../nanvm-lib/todo/mvp-roadmap.md) — the
  parser, serializer, and deserializer tasks are blocked by this spec.
- [`lang/README.md` §9](./lang/README.md#9-serialization-ast-not-bytecode) —
  the AST-not-bytecode decision.
