## MVP Roadmap

**Priority:** P1
**Status:** open

### Problem

The primary focus is to get to MVP ASAP.

**MVP definition:** the MVP is reached when we use our FJS CLI executable to
parse and compile FJS code into generated Rust code that calls the
`nanvm-lib` API, build it with the Rust compiler, and run the resulting
executable:

```
source ──(fjs: parse, compile, generate Rust)──> Rust code
       ──(rustc + nanvm-lib)──> executable ──(run)──> result
```

The generated program evaluates the module's `export default` (running it if
it is a function) and prints the result to stdout as JSON.

So the MVP requires the FJS CLI (`fjs`) and the Rust toolchain; the
self-hosted `nanvm` executable is the post-MVP milestone below
(see [console-program](./console-program.md)).

See [`todo/lang/`](../../todo/lang/README.md) for language details. Details
for individual items below are added only after discussion.

### Proposal

#### Canonical representation: the AST as data (decided)

The stable, canonical representation of functions is the **AST**, expressed
as an FJS value (`Any`). Code is data: the `Function` constructor accepts an
`Any` that describes the code, and the VM knows how to execute it. The
reasons:

1. We need a canonical data representation of functions in FunctionalScript —
   and in the future content-addressable VM (CAVM) — to compute a hash.
2. The AST can be transformed back to source code; this transformation will
   be used in `toString(f)`.
3. Because code is an FJS value, serializing functions requires no separate
   format: once the VM serializes `Any` values, it serializes code too.

Bytecode is an advanced, performance-oriented representation that may vary
across architectures, VM implementations, and versions, while the AST is the
stable representation. See
[`todo/lang/README.md` §9](../../todo/lang/README.md#9-serialization-ast-as-data-not-bytecode).

The exact shape of the code-describing `Any` (tags/shapes) is specified by
the [ast-spec](../../todo/ast-spec.md) — the contract of the `Function`
constructor.

#### Execution: two paths (decided)

1. **Interpretation** — the `Function` constructor executes the `Any` code
   description directly. This is the baseline path, required for the
   self-hosted `nanvm` and for code constructed at run time.
2. **AOT compilation** — the FJS compiler generates Rust code that calls the
   `nanvm-lib` API, and rustc compiles it to native code. This path is the
   MVP pipeline, the bootstrap vehicle for compiling the compiler itself into
   `nanvm`, and the future AOT backend for platforms where interpretation is
   undesirable or JIT is forbidden (e.g. iOS, embedded).

Invariants:

- The two paths are **observably identical** except in performance. Both
  bottom out in the same `nanvm-lib` operators, so the shared operator tests
  (see below) cover their common layer; divergence risk is confined to
  control flow and dispatch.
- A natively compiled function still **carries its `Any` code description**
  (as static data), so content hashing and `toString(f)` apply uniformly to
  all functions: the AST is the identity of a function; native code is a
  cached acceleration of it.
- The interpreter sits behind a cargo **feature flag**, so AOT builds for
  embedded targets that never construct functions from data at run time can
  compile without it.

#### What changed (vs. the earlier serialized-AST proposal)

Previously the MVP pipeline sent a CBOR-serialized AST from `fjs` to a
`nanvm` executable, which required an AST wire-format spec, an FJS
serializer, and a Rust deserializer on the critical path. That interprocess
handoff is replaced by Rust code generation: rustc takes the place of the
deserializer. Serialization of `Any` values (binary encoding: **CBOR**,
[RFC 8949](https://www.rfc-editor.org/rfc/rfc8949), chosen for exact IEEE 754
doubles) is still wanted — for CAVM hashing, storage, and interchange — but
as a generic `Any` facility, post-MVP.

### Tasks

#### P1

- [ ] **Rust code generator** (FJS) — compiles an FJS module into a Rust
      crate that builds the module's value via the `nanvm-lib` API. The
      central MVP task; rustc replaces the previous deserializer task.
- [ ] **`fjs`–Rust integration** — wire the pipeline end-to-end early
      ("walking skeleton"): a minimal subset (e.g. a constant default
      export) is enough to start — generate the crate, `cargo run` it, print
      the result as JSON — so every later feature lands into a working
      pipeline. See
      [fjs-nanvm-integration](../../todo/fjs-nanvm-integration.md).
- [ ] **Test generation for operators** — one test-data module drives both
      the FJS proof (JS engine reference) and the generated Rust tests.
      Implement **before** the operators task below, so every new operator is
      tested once, not twice. Doubly important now: the shared operator layer
      is what keeps the interpreter and the generated code in agreement. See
      [single-source-of-truth-for-operator-tests](./single-source-of-truth-for-operator-tests.md).
- [ ] **Complete all basic FunctionalScript operators** (Rust), including the
      short-circuit operators `&&`, `||`, `??` (lazy evaluation, like `?:`).
      Preceded by the test-generation task above.
      Current status: [operator tables in `nanvm-lib/README.md`](../README.md).
      Spec: [operators](../../todo/lang/2340-operators.md).
- [ ] **Parser**, using [`fs/bnf/`](../../fs/bnf/README.md) (FJS).

#### P2

- [ ] **AST spec** — the RTTI schema of the code-describing `Any`; the
      contract of the `Function` constructor, shared by the compiler, the
      interpreter, and the code generator (which embeds it as static data).
      See [ast-spec](../../todo/ast-spec.md).
- [ ] **`Function` constructor + interpreter** (Rust) — accepts an `Any`
      described by the AST spec and executes it; behind a cargo feature
      flag. Related: [fs-vm-load-save](./fs-vm-load-save.md).
- [ ] **Basic control operator `?:`** (Rust).
- [ ] **Nested functions** (function frame) (Rust).
      See [function](../../todo/lang/3110-function.md),
      [function-frame](../../todo/lang/3111-function-frame.md).

#### P3

- [ ] **Control statements**: `if`, `while`, etc. (Rust).
      See [`todo/lang/README.md` §3.2](../../todo/lang/README.md).
- [ ] **`Any` serialization (CBOR)** — generic serialization of `Any`
      values, which covers code as data; includes the deterministic profile
      needed for CAVM hashing (see open questions).

#### P4

- [ ] **Generators**, etc. (Rust).

### Post-MVP milestone: self-hosting

Compile the compiler itself (written in FJS) to Rust with the code generator
and embed it into the `nanvm` executable
([console-program](./console-program.md)): a single native executable that
parses and runs `.f.js` directly — no Node/Deno, no interprocess handoff —
executing code via the interpreter behind the `Function` constructor.

Reached incrementally: the code generator's language coverage grows with the
operator/function/control tasks above until it covers everything the
compiler's own code uses.

### Open questions

1. **Deterministic CBOR profile.** For content hashing (CAVM), the encoding
   must be canonical: one value, one byte sequence, one hash. RFC 8949 §4.2
   ("Core Deterministic Encoding") requires shortest-form integers and floats
   (a double that fits in a 16/32-bit float must be encoded shorter), which
   conflicts with "always 8-byte doubles". Do we adopt RFC 8949 §4.2 as-is,
   or define our own profile (e.g. always 64-bit floats)? Belongs to the
   `Any` serialization task (P3).
2. **Rust toolchain in the loop.** `fjs vm run` invokes cargo/rustc; a
   compile per program run is acceptable for the MVP dev loop, but how do we
   keep it fast (shared target dir, prebuilt `nanvm-lib`), and what is the
   fallback for users without a Rust toolchain before self-hosting lands?
3. **Result printing.** The generated program prints the result to stdout as
   JSON, but a result can be non-JSON (`undefined`, `bigint`, a function).
   Does the MVP print DJS for those, or report an error?

### Related

- [`todo/lang/README.md`](../../todo/lang/README.md) — the language spec and
  tag tables; §9 records the AST-as-data decision and the two execution
  paths.
- [ast-spec](../../todo/ast-spec.md) — the schema (RTTI) of the
  code-describing `Any`; the `Function` constructor contract.
- [fjs-nanvm-integration](../../todo/fjs-nanvm-integration.md) — the
  walking-skeleton integration and the `fjs vm build` / `fjs vm run` CLI.
- [console-program](./console-program.md) — the self-hosted `nanvm`
  executable (post-MVP).
- [single-source-of-truth-for-operator-tests](./single-source-of-truth-for-operator-tests.md)
  — test generation preceding the operators task.
- [fs-vm-load-save](./fs-vm-load-save.md) — load/execute/save semantics.
