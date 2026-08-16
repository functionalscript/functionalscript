## AST spec

**Priority:** P2
**Status:** open

### Problem

The AST is the stable, canonical representation of functions, expressed as an
FJS value (`Any`): the `Function` constructor accepts an `Any` that describes
the code and executes it (see
[`spec/todo/serialization.md`](../spec/todo/serialization.md)).
Several components must agree on the exact shape of that value:

- the parser/compiler (FJS), which produces it;
- the `Function` constructor and its interpreter (Rust), which execute it;
- the Rust code generator, which embeds it as static data in natively
  compiled functions so hashing and `toString(f)` apply uniformly;
- the content hash (CAVM) and `toString(f)`, which require the shape to be
  exact — one AST, one byte sequence, one hash.

[`spec/`](../spec/README.md) and
[`spec/todo/`](../spec/todo/README.md) list the value kinds of each level, but
there is no single specification of record, so the implementations have
nothing precise to be checked against.

### Proposal

Define the AST with **RTTI** ([`fjs/types/rtti`](../fjs/types/rtti/README.md)):
an RTTI schema (an FJS module) is the specification of record, and Rust code
for the AST types and the `Function` constructor's input
validation/construction is **generated** from it.

Why RTTI:

- Single source of truth: the FJS side gets the TypeScript types (`Ts<T>`),
  `validate`, and `parse` directly from the schema; the Rust side gets
  generated types and validation code from the same schema.
- Precedent: [`fjs/types/rtti/ts`](../fjs/types/rtti/ts/README.md) already
  prints schemas as TypeScript types; the Rust generator follows the same
  pattern with a Rust printer.
- RTTI already supports the shapes an AST needs: structs, tuples, `or`
  (unions), and recursion via `Thunk`.

The RTTI schema is the only specification of the AST shape;
[`spec/`](../spec/README.md) stays a prose overview of the levels and
their features.

Serialization needs no separate treatment here: the AST is an `Any` value, so
the generic `Any` serialization (CBOR, including the deterministic profile
for CAVM hashing) covers it — see the P3 task and open question in
[mvp-roadmap](../nanvm-lib/todo/mvp-roadmap.md).

### Tasks

- [ ] Define the AST schema as an RTTI schema (FJS module) covering all MVP
      nodes: JSON level (§1), DJS level (§2: `const_ref`, `bigint`,
      operators, …), FJS level (§3: function, parameters, captured consts).
- [ ] Implement a Rust code generator from RTTI schemas: AST types +
      validation of the `Any` shape accepted by the `Function` constructor
      (following the pattern of the TypeScript printer in
      [`fjs/types/rtti/ts`](../fjs/types/rtti/ts/README.md)).
- [ ] Provide conformance examples (test vectors) shared by the FJS and Rust
      implementations.

### Related

- [nanvm-lib/todo/mvp-roadmap.md](../nanvm-lib/todo/mvp-roadmap.md) — the
  `Function` constructor and interpreter tasks are blocked by this spec.
- [`spec/todo/serialization.md`](../spec/todo/serialization.md)
  — the AST-as-data decision and the two execution paths.
