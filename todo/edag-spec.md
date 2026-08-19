## EDAG spec

**Priority:** P2
**Status:** open

### Problem

The EDAG is the stable, canonical representation of functions, expressed as an
FJS value (`Any`): the `Function` constructor accepts an `Any` that describes
the code and executes it (see
[`spec/todo/serialization.md`](../spec/todo/serialization.md)).
Several components must agree on the exact shape of that value:

- the parser/compiler (FJS), which produces it;
- the `Function` constructor and its interpreter (Rust), which execute it;
- the Rust code generator, which embeds it as static data in natively
  compiled functions so hashing and `toString(f)` apply uniformly;
- the content hash (CAVM) and `toString(f)`, which require the shape to be
  exact — one EDAG, one byte sequence, one hash.

[`spec/`](../spec/README.md) and
[`spec/todo/`](../spec/todo/README.md) list the value kinds of each level, but
there is no single specification of record, so the implementations have
nothing precise to be checked against.

The working semantic design lives in
[`edag-stage1-discussion.md`](./edag-stage1-discussion.md). The concrete DJS
rollout is staged separately in
[`compile-modules-to-edag.md`](../fjs/djs/todo/compile-modules-to-edag.md):
Stage 1 adds property access and unresolved modules; Stage 2 adds non-capturing
functions and calls. Those TODOs define implementation order, while this file
owns the eventual complete schema.

### Proposal

Define the EDAG with **RTTI** ([`fjs/types/rtti`](../fjs/types/rtti/README.md)):
an RTTI schema (an FJS module) is the specification of record, and Rust code
for the EDAG types and the `Function` constructor's input
validation/construction is **generated** from it.

Why RTTI:

- Single source of truth: the FJS side gets the TypeScript types (`Ts<T>`),
  `validate`, and `parse` directly from the schema; the Rust side gets
  generated types and validation code from the same schema.
- Precedent: [`fjs/types/rtti/ts`](../fjs/types/rtti/ts/README.md) already
  prints schemas as TypeScript types; the Rust generator follows the same
  pattern with a Rust printer.
- RTTI already supports the shapes an EDAG needs: structs, tuples, `or`
  (unions), and recursion via `Thunk`.

The RTTI schema is the only specification of the EDAG shape;
[`spec/`](../spec/README.md) stays a prose overview of the levels and
their features.

Serialization needs no separate treatment here: the EDAG is an `Any` value, so
the generic `Any` serialization (CBOR, including the deterministic profile
for CAVM hashing) covers it — see the P3 task and open question in
[mvp-roadmap](../nanvm-lib/todo/mvp-roadmap.md). DJS `const` declarations and
references are a serialization mechanism for semantic node sharing, not a
separate `const_ref` EDAG operation. DJS `.f.js` parser/serializer rollout,
including special-number round trips, belongs to
[`compile-modules-to-edag.md`](../fjs/djs/todo/compile-modules-to-edag.md);
standard JSON numeric policy remains separate in
[`number-edge-cases.md`](../fjs/media/json/todo/number-edge-cases.md).

### Tasks

- [ ] Define the EDAG schema as an RTTI schema (FJS module) covering the
      canonical operation forms decided in
      [`edag-stage1-discussion.md`](./edag-stage1-discussion.md), including
      semantic node sharing without a `const_ref` EDAG node.
- [ ] Keep the schema compatible with the staged DJS implementation in
      [`compile-modules-to-edag.md`](../fjs/djs/todo/compile-modules-to-edag.md)
      while allowing later operations to be added without changing existing
      canonical forms.
- [ ] Implement a Rust code generator from RTTI schemas: EDAG types +
      validation of the `Any` shape accepted by the `Function` constructor
      (following the pattern of the TypeScript printer in
      [`fjs/types/rtti/ts`](../fjs/types/rtti/ts/README.md)).
- [ ] Provide conformance examples (test vectors) shared by the FJS and Rust
      implementations.

### Related

- [`edag-stage1-discussion.md`](./edag-stage1-discussion.md) — working EDAG
  semantics, operation vocabulary, validation rules, and staging decisions.
- [`fjs/djs/todo/compile-modules-to-edag.md`](../fjs/djs/todo/compile-modules-to-edag.md)
  — concrete parser/module rollout for Stage 1 and Stage 2.
- [`fjs/djs/todo/157.md`](../fjs/djs/todo/157.md) — existing JSON/DJS
  parser/serializer structural deduplication work.
- [`fjs/media/json/todo/number-edge-cases.md`](../fjs/media/json/todo/number-edge-cases.md)
  — existing owner of standard JSON numeric edge-case policy.
- [`spec/todo/2330-property-accessor.md`](../spec/todo/2330-property-accessor.md)
  — property/method-access safety rules used by `.` and `.()`.
- [`spec/todo/3110-function.md`](../spec/todo/3110-function.md) — source-level
  function support.
- [`spec/todo/3111-function-frame.md`](../spec/todo/3111-function-frame.md) —
  captured-frame and VM-internal function-object design; frame support is later
  than the initial non-capturing EDAG stage.
- [`spec/todo/9100-call-like-instructions.md`](../spec/todo/9100-call-like-instructions.md)
  — VM-internal lowering of calls; it is not the stable EDAG call format.
- [nanvm-lib/todo/mvp-roadmap.md](../nanvm-lib/todo/mvp-roadmap.md) — the
  `Function` constructor and interpreter tasks are blocked by this spec.
- [`spec/todo/serialization.md`](../spec/todo/serialization.md)
  — the EDAG-as-data decision and the two execution paths.
