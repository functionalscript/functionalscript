## MVP Roadmap

**Priority:** P1
**Status:** open

### Problem

The primary focus is to get to MVP ASAP.

**MVP definition:** the MVP is reached when we use our FJS CLI executable to
parse and compile FJS code, and then run it by sending the serialized AST to
our `nanvm` executable:

```
source ──(fjs: parse, compile)──> serialized AST ──(nanvm: deserialize, run)──> result
```

So the MVP requires two executables: the FJS CLI (`fjs`) and `nanvm`
(see [console-program](./console-program.md)).

See [`todo/lang/`](../../todo/lang/README.md) for language details. Details for
individual items below are added only after discussion.

### Proposal

#### Serializable format: AST, not bytecode (decided)

The stable, serializable, standard representation of functions is the **AST**.
The reasons:

1. We need a canonical data representation of functions in FunctionalScript —
   and in the future content-addressable VM (CAVM) — to compute a hash.
2. The AST can be transformed back to source code; this transformation will be
   used in `toString(f)`.

Bytecode is an advanced, performance-oriented representation that may vary
across architectures, VM implementations, and versions, while the AST is the
stable representation. A VM can also use the AST itself as its byte code,
interpreting it directly — the simplest option for the MVP. See
[`todo/lang/README.md` §9](../../todo/lang/README.md#9-serialization-ast-not-bytecode).

The AST is plain data, expressible as JSON/DJS values; it covers all levels of
the language, including the FJS-level nodes — function, parameters, captured
consts — represented as data (see
[`todo/lang/README.md` §3](../../todo/lang/README.md#3-fjs)). The binary
encoding is **CBOR** ([RFC 8949](https://www.rfc-editor.org/rfc/rfc8949)) — a
CBOR representation of that JSON/DJS-shaped data — because it represents
numbers as exact IEEE 754 doubles, avoiding the ambiguous binary↔decimal
number conversion of text formats.

### Tasks

#### P1

- [ ] **AST spec** — the single schema (tags/shapes + CBOR mapping) that the
      parser, the serializer, and the deserializer implement.
      Blocks all three. See [ast-spec](../../todo/ast-spec.md).
- [ ] **Test generation for operators** — one test-data module drives both
      the FJS proof (JS engine reference) and the generated Rust tests.
      Implement **before** the operators task below, so every new operator is
      tested once, not twice. See
      [single-source-of-truth-for-operator-tests](./single-source-of-truth-for-operator-tests.md).
- [ ] **Complete all basic FunctionalScript operators** (Rust), including the
      short-circuit operators `&&`, `||`, `??` (lazy evaluation, like `?:`).
      Preceded by the test-generation task above.
      Current status: [operator tables in `nanvm-lib/README.md`](../README.md).
      Spec: [operators](../../todo/lang/2340-operators.md).
- [ ] **Deserializer** for the serialized AST (Rust).
      Related: [fs-vm-load-save](./fs-vm-load-save.md).
- [ ] **`nanvm` executable** — receives the serialized AST, deserializes it,
      evaluates the module's `export default` (running it if it is a
      function), and prints the result to stdout as JSON; the MVP's delivery
      vehicle. See [console-program](./console-program.md).
- [ ] **`fjs`–`nanvm` integration** — wire the pipeline end-to-end early
      ("walking skeleton"): a minimal AST subset (e.g. a constant default
      export) is enough to start, before the other tasks are complete, so
      every later feature lands into a working pipeline.
      See [fjs-nanvm-integration](../../todo/fjs-nanvm-integration.md).
- [ ] **Parser**, using [`fs/bnf/`](../../fs/bnf/README.md) (FJS).

#### P2

- [ ] **Basic control operator `?:`** (Rust).
- [ ] **Nested functions** (function frame) (Rust).
      See [function](../../todo/lang/3110-function.md),
      [function-frame](../../todo/lang/3111-function-frame.md).
- [ ] **AST serializer** (FJS).

#### P3

- [ ] **Control statements**: `if`, `while`, etc. (Rust).
      See [`todo/lang/README.md` §3.2](../../todo/lang/README.md).

#### P4

- [ ] **Generators**, etc. (Rust).

### Open questions

1. **Deterministic CBOR profile.** For content hashing (CAVM), the encoding
   must be canonical: one AST, one byte sequence, one hash. RFC 8949 §4.2
   ("Core Deterministic Encoding") requires shortest-form integers and floats
   (a double that fits in a 16/32-bit float must be encoded shorter), which
   conflicts with "always 8-byte doubles". Do we adopt RFC 8949 §4.2 as-is, or
   define our own profile (e.g. always 64-bit floats)?
2. **Priority mismatch.** The Rust deserializer is P1 but the FJS AST
   serializer producing its input is P2. Until the serializer lands, does the
   Rust side test against hand-written AST data?
3. **Result printing.** `nanvm` prints the result to stdout as JSON, but a
   result can be non-JSON (`undefined`, `bigint`, a function). Does the MVP
   print DJS for those, or report an error?

### Related

- [`todo/lang/README.md`](../../todo/lang/README.md) — the language spec and
  serialization tag tables; §9 records the AST-not-bytecode decision.
- [ast-spec](../../todo/ast-spec.md) — the AST schema (RTTI) that the P1
  tasks implement.
- [fjs-nanvm-integration](../../todo/fjs-nanvm-integration.md) — the
  walking-skeleton integration and the `fjs vm build` / `fjs vm run` CLI.
- [console-program](./console-program.md) — the `nanvm` executable.
- [single-source-of-truth-for-operator-tests](./single-source-of-truth-for-operator-tests.md)
  — test generation preceding the operators task.
- [fs-vm-load-save](./fs-vm-load-save.md) — load/execute/save semantics.
