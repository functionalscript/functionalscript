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

### Tasks

- [ ] Decide where the specification of record lives: extend the tag tables
      in [`lang/README.md`](./lang/README.md) or a standalone spec document.
- [ ] Define tags and shapes for all MVP nodes:
      JSON level (§1), DJS level (§2: `const_ref`, `bigint`, operators, …),
      FJS level (§3: function, parameters, captured consts).
- [ ] Define the CBOR mapping, including the deterministic profile
      (see the open question in
      [mvp-roadmap](../nanvm-lib/todo/mvp-roadmap.md#open-questions)).
- [ ] Provide conformance examples (test vectors) shared by the FJS and Rust
      implementations.

### Related

- [nanvm-lib/todo/mvp-roadmap.md](../nanvm-lib/todo/mvp-roadmap.md) — the
  parser, serializer, and deserializer tasks are blocked by this spec.
- [`lang/README.md` §9](./lang/README.md#9-serialization-ast-not-bytecode) —
  the AST-not-bytecode decision.
