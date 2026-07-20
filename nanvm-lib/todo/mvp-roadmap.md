## MVP Roadmap

**Priority:** P1
**Status:** open

### Problem

The primary focus is to get to MVP ASAP.

**MVP definition:** the MVP is reached when `fjs compile` can emit Rust code
that calls the `nanvm-lib` API, and a harness crate builds and runs the
generated code with cargo:

```
source ──(fjs compile <module> <output>.rs)──> Rust code
       ──(cargo: harness crate + nanvm-lib)──> executable ──(run)──> result
```

The harness evaluates the module's `export default` (running it if it is a
function) and prints the result to stdout as JSON.

`fjs` never invokes cargo: the npm-shipped tool emits `.rs` files, and
building/running them is an ordinary cargo workflow. Each ecosystem keeps its
native tool. The self-hosted `nanvm` crate is the post-MVP milestone below
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
   self-hosted `nanvm` crate and for code constructed at run time.
2. **AOT compilation** — the FJS compiler generates Rust code that calls the
   `nanvm-lib` API, and rustc compiles it to native code. This path is the
   MVP pipeline, the bootstrap vehicle for compiling the compiler itself into
   the `nanvm` crate, and the future AOT backend for platforms where
   interpretation is undesirable or JIT is forbidden (e.g. iOS, embedded).

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

#### Rust code generation: an output target of `fjs compile` (decided)

`fjs compile <input> <output>` already dispatches on the output extension
(`.json` vs. DJS — see [`fs/djs/module.f.ts`](../../fs/djs/module.f.ts));
Rust code generation is a third branch, selected by the `.rs` extension. No
new CLI surface: the previously proposed `fjs vm build` / `fjs vm run`
command group is dropped.

One FJS module compiles to one Rust file, and the generated file is a Rust
**module** — exposing the module's value via the `nanvm-lib` API (e.g.
`pub fn module<A: IVm>() -> Any<A>`) — not a `main`. A thin, hand-written
`main` lives in the consumer: the test harness in this repo, the `nanvm`
crate, or a user's own crate. This way the same generated output serves
testing, self-hosting, and AOT embedding.

#### Effects: the `nanvm-effects-node` runner crate (decided)

The compiler CLI is pure FJS that *returns* effect descriptions
(`Effect<NodeOp, T>`); all actual impurity lives in thin `.ts` runner
modules (e.g. [`fs/effects/node/module.ts`](../../fs/effects/node/module.ts)),
which are not FJS and never pass through the code generator. The
`.f.ts`/`.ts` split is exactly the compiled/hand-written boundary: every
`.f.ts` module compiles to Rust; every impure `.ts` runner needs a
hand-written Rust twin interpreting the same operation vocabulary against
the OS (`std::fs`, `std::process`, stdio) instead of Node built-ins.

The Rust twin of `fs/effects/node` is the **`nanvm-effects-node`** library
crate — named to mirror the effect directory structure: this specific
effect set is the CLI-on-Node vocabulary, and future sets (e.g. a browser
set with `fetch`, DOM, and some shared effects) follow the same pattern.
It is a separate crate in the same workspace, published on crates.io:
`nanvm-lib` stays pure (no OS dependencies — keeping a future `no_std`
embedded profile open), and the `nanvm` binary depends on both. It serves
any AOT-compiled effectful FJS program, not just the embedded compiler —
it is to native FJS what `fs/effects/node/module.ts` is to Node FJS.

**Generated stub — the vocabulary is machine-checked.** The Rust side of
the effect vocabulary is not written by hand: a **generated stub** (op,
parameter, and result types, plus a trait with one method per operation)
is produced from the effects description, and the hand-written
`nanvm-effects-node` runner implements the generated trait — so rustc
enforces that the runner covers exactly the same effects, and any
vocabulary drift (a new operation, a changed signature) breaks the Rust
build until the twin catches up. Since `NodeOp` today is TypeScript types
only and the code generator compiles FJS values, the vocabulary becomes an
**RTTI schema** (the specification of record) from which both the TS types
(`Ts<T>`) and the Rust stub are derived — the third instance of the
single-source pattern, after the [ast-spec](../../todo/ast-spec.md) and the
operator tests. The stub is generated code: it lives in an
underscore-prefixed directory and follows the same regenerate-then-build /
publish-time packaging rules as the generated compiler source (see the
distribution section below).

Scoping notes:

- **Sync subset first.** The compiler CLI needs file read/write, console,
  and possibly `exec` — a blocking `std` implementation covers it. `Http`,
  `Fetch`, and parallel effects are where an async-runtime decision
  (tokio?) lurks; implement operations incrementally, driven by what the
  CLI actually exercises, and defer that decision entirely.
- **`import` is the special operation.** On Node it delegates to the module
  loader; natively, importing an FJS module means invoking the embedded
  compiler and the `Function`-constructor interpreter — its implementation
  is the VM itself, not an OS call. It is part of the self-hosting loop,
  not a syscall port.
- **Testing comes cheap.** The in-memory/mock interpreters
  ([`fs/effects/mock`](../../fs/effects/mock),
  [`fs/effects/node/memory`](../../fs/effects/node/memory)) are pure
  `.f.ts` code, so they compile through the code generator unchanged: the
  compiled CLI can run against in-memory effects with no Rust twins, and
  the `nanvm-effects-node` runner can be cross-checked against the pure
  interpreter operation by operation.

#### Distribution: one source, two packages (decided)

The compiler has a single source (FJS), shipped two ways:

- **npm** — FJS code only, running on Node/Deno; the `fjs` CLI as today.
- **crates.io** — the `nanvm` crate: the `nanvm-lib` runtime plus the
  generated Rust of the same compiler source (packaged at publish time, see
  below), built by cargo into a native executable
  (see [console-program](./console-program.md)).

Crates.io never builds the crate itself: the published package is built by
every user's machine on `cargo install`, by docs.rs (sandboxed, **no
network**), and by offline/vendored downstream builds. So the published
`.crate` must build with nothing but cargo, rustc, and its declared
dependencies.

**Publish-time generation (decided):** the generated Rust of the compiler
is never committed to git and adds no build dependencies for consumers. The
generated code lives in an underscore-prefixed directory — the repository
reserves `_*` for generated files in `.gitignore` — and `Cargo.toml`'s
`include` field lists it explicitly (when `include` is specified, cargo
packages exactly those paths, gitignore notwithstanding); the publish
workflow runs the code generator and then `cargo publish`, so the generated
`.rs` rides along in the `.crate` only — the same arrangement as npm
packages shipping built `dist/` files that are never committed. The
`.crate` is a distribution artifact, not the source of record.

Rejected alternatives: committing the generated code to the repository
(generated code in git); generating on the fly in `build.rs` with a JS
engine as a build dependency — Deno/V8 downloads binaries at build time,
breaking docs.rs and offline builds, and even a hermetic lightweight engine
(QuickJS, Boa) would tax every consumer with a third-party engine build and
make build correctness depend on a third engine.

**Developer workflow (decided):** regeneration is unconditional — the
developer entry point for the crate is "regenerate, then build", with the
codegen step folded into `npm run update`, and the generator writes a file
only when its content actually changed, so a no-op regeneration leaves
mtimes untouched and cargo's fingerprinting skips the rebuild. There is
deliberately **no `build.rs`**: a presence check would wave through the
dangerous case (stale generated code), and sound staleness detection would
re-implement a build system inside a build script — unconditional-but-cheap
beats conditional-but-clever, and a crate without a build script also
builds faster and is friendlier to consumers who audit or restrict
build-script execution. The failure modes sort themselves out: a fresh
checkout without the script fails with rustc's plain "couldn't read
`…/_generated/…`" error (documented in CONTRIBUTING); locally stale output
cannot survive past the developer's machine because CI regenerates from
scratch, so the merge gate and the publish reproducibility check always
operate on fresh output; consumers are never affected, since the published
`.crate` always contains matching generated code. The workspace's
`default-members` excludes the `nanvm` crate, so plain `cargo build` /
`cargo test` for `nanvm-lib` development stays Node-free; building the
`nanvm` crate explicitly is the case that needs the pre-step (Node
installed and the wrapper script run).

Dual shipping doubles as a permanent conformance test: both distributions
must emit **byte-identical** `.rs` output for the same input. This also
makes the published artifact reproducible — anyone can regenerate from the
FJS source and diff against the shipped code, and CI does exactly that as a
reproducibility check before publishing. Once the crate ships, the check
closes into a fixed point: the crate-shipped compiler regenerates its own
packaged source, identically.

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

- [ ] **Rust code generator** (FJS) — the `.rs` output branch of
      `fjs compile`: compiles an FJS module into a Rust module that builds
      the module's value via the `nanvm-lib` API. The central MVP task;
      rustc replaces the previous deserializer task.
- [ ] **Harness + walking skeleton** — a harness crate (or generated tests
      in `nanvm-lib`) whose `main` evaluates a generated module's
      `export default` and prints the result as JSON; wire the pipeline
      end-to-end early with a minimal subset (e.g. a constant default
      export), driven by `cargo test` in CI, so every later feature lands
      into a working pipeline. See
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
- [ ] **`nanvm-effects-node` crate** (Rust) — the effect runner: implements
      the generated stub trait against the OS; sync subset (fs, console)
      first. Preceded by defining the effect vocabulary as an RTTI schema
      and generating the Rust stub from it, so rustc enforces that the
      runner implements the same effects (see the effects section above).
      Required for the self-hosted CLI.

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
and ship it as the `nanvm` crate
([console-program](./console-program.md)): a single native executable that
parses and runs `.f.js` directly — no Node/Deno, no rustc at the user's run
time — executing code via the interpreter behind the `Function` constructor,
with its I/O interpreted by the `nanvm-effects-node` runner (see the effects
section above).

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
2. **Generated module imports.** An FJS module imports other modules. What is
   the convention for how generated Rust modules reference each other
   (`use` paths, file/directory layout mirroring the FJS module graph)? And
   does `fjs compile <input> <output>.rs` emit the transitive closure as
   multiple files, or is it invoked per module?
3. **Result printing.** The harness prints the result to stdout as JSON, but
   a result can be non-JSON (`undefined`, `bigint`, a function). Does the MVP
   print DJS for those, or report an error?
4. **Binary name.** The npm tool is `fjs`; the crate is `nanvm`. Should the
   crate's binary also be named `fjs` (same CLI surface, native), or `nanvm`?

### Related

- [`todo/lang/README.md`](../../todo/lang/README.md) — the language spec and
  tag tables; §9 records the AST-as-data decision and the two execution
  paths.
- [ast-spec](../../todo/ast-spec.md) — the schema (RTTI) of the
  code-describing `Any`; the `Function` constructor contract.
- [fjs-nanvm-integration](../../todo/fjs-nanvm-integration.md) — the
  walking-skeleton integration: the `.rs` output target and the harness.
- [console-program](./console-program.md) — the self-hosted `nanvm` crate
  (post-MVP).
- [single-source-of-truth-for-operator-tests](./single-source-of-truth-for-operator-tests.md)
  — test generation preceding the operators task.
- [fs-vm-load-save](./fs-vm-load-save.md) — load/execute/save semantics.
