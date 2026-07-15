# MVP Roadmap

**Priority:** P1
**Status:** open

The primary focus is to get to MVP ASAP: a minimal end-to-end pipeline where FJS
source is parsed (FJS), serialized as an AST, and loaded and executed by
`nanvm-lib` (Rust).

See [`todo/lang/`](../../todo/lang/README.md) for language details. Details for
individual items below are added only after discussion.

## Serializable format: AST, not bytecode (decided)

The stable, serializable, standard representation of functions is the **AST**.
The reasons:

1. We need a canonical data representation of functions in FunctionalScript —
   and in the future content-addressable VM (CAVM) — to compute a hash.
2. The AST can be transformed back to source code; this transformation will be
   used in `toString(f)`.

Bytecode is an advanced, performance-oriented representation that may vary
across architectures, VM implementations, and versions, while the AST is the
stable representation. See
[`todo/lang/README.md` §9](../../todo/lang/README.md#9-serialization-ast-not-bytecode).

For FJS, the AST means JSON or DJS. The binary encoding is **CBOR**
([RFC 8949](https://www.rfc-editor.org/rfc/rfc8949)) — a CBOR representation
of JSON/DJS — because it represents numbers as exact IEEE 754 doubles,
avoiding the ambiguous binary↔decimal number conversion of text formats.

## Tasks

### P1

- [ ] **AST spec** — the single schema (tags/shapes + CBOR mapping) that the
      parser, the serializer, and the deserializer implement.
      Blocks all three. See [ast-spec](../../todo/ast-spec.md).
- [ ] **Complete all basic FunctionalScript operators** (Rust), including the
      short-circuit operators `&&`, `||`, `??` (lazy evaluation, like `?:`).
      Current status: [operator tables in `nanvm-lib/README.md`](../README.md).
      Spec: [operators](../../todo/lang/2340-operators.md).
- [ ] **Deserializer** for the serialized AST (Rust).
      Related: [fs-vm-load-save](./fs-vm-load-save.md).
- [ ] **Parser**, using [`fs/bnf/`](../../fs/bnf/README.md) (FJS).

### P2

- [ ] **Basic control operator `?:`** (Rust).
- [ ] **Nested functions** (function frame) (Rust).
      See [function](../../todo/lang/3110-function.md),
      [function-frame](../../todo/lang/3111-function-frame.md).
- [ ] **AST serializer** (FJS).

### P3

- [ ] **Control statements**: `if`, `while`, etc. (Rust).
      See [`todo/lang/README.md` §3.2](../../todo/lang/README.md).

### P4

- [ ] **Generators**, etc. (Rust).

## Open questions

1. **Deterministic CBOR profile.** For content hashing (CAVM), the encoding
   must be canonical: one AST, one byte sequence, one hash. RFC 8949 §4.2
   ("Core Deterministic Encoding") requires shortest-form integers and floats
   (a double that fits in a 16/32-bit float must be encoded shorter), which
   conflicts with "always 8-byte doubles". Do we adopt RFC 8949 §4.2 as-is, or
   define our own profile (e.g. always 64-bit floats)?
2. **Priority mismatch.** The Rust deserializer is P1 but the FJS AST
   serializer producing its input is P2. Until the serializer lands, does the
   Rust side test against hand-written AST data?
