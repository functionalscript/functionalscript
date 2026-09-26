## MVP Roadmap

**Priority:** P1
**Status:** open

### Problem

The MVP is reached, as
[fjs-nanvm-integration](../../todo/fjs-nanvm-integration.md) records. The
remaining tasks here, P2 and below, and the self-hosting milestone are
post-MVP.

The MVP — `fjs compile` emitting Rust that calls the `nanvm-lib` API, built and
run by a harness crate with cargo — is defined and tracked in
[fjs-nanvm-integration](../../todo/fjs-nanvm-integration.md): the export-object
module contract, the named-module acceptance example, the `.rs` output target
and harness export selection.
This file records the design decided around that pipeline and the work after
it, toward the self-hosted `nanvm` crate
([console-program](./console-program.md)).

See [`spec/`](../../spec/README.md) for language details. Details
for individual items below are added only after discussion.

### Proposal

Keep handwritten Rust low-level: VM values/operators and host effect handlers.
The parser, compiler, loader, interpreter and test logic belong in FJS and are
compiled to direct Rust ahead of time as their dependency closures become
compiler-supported. The optional [Rust EDAG library](../../todo/rust-edag.md)
is on hold, outside MVP and the self-hosting prerequisites.

#### Canonical representation: the EDAG as data (decided)

The stable, canonical representation of functions is the **EDAG**, expressed
as an FJS value (`Any`). Code as data does not require a handwritten Rust
EDAG representation or executor in the VM foundation. The reasons for the
canonical representation:

1. We need a canonical data representation of functions in FunctionalScript —
   and in the future content-addressable VM (CAVM) — to compute a hash.
2. The EDAG can be transformed back to source code; this transformation will
   be used in `toString(f)`.
3. Because code is an FJS value, serializing functions requires no separate
   format: once the VM serializes `Any` values, it serializes code too.

Bytecode is an advanced, performance-oriented representation that may vary
across architectures, VM implementations, and versions, while the EDAG is the
stable representation. See
[`spec/todo/serialization.md`](../../spec/todo/serialization.md).

The exact shape of the code-describing `Any` is specified by the RTTI schema
in [`fjs/edag`](../../fjs/edag/README.md), shared by producers and executors.

#### Execution: two paths (decided)

1. **FJS interpretation** — the existing
   [FJS interpreter](../../fjs/fsc/todo/interpret-edag.md) executes the linked
   EDAG as data. For the native executable, this interpreter and the FJS
   loading pipeline are themselves compiled to Rust ahead of time. Runtime
   module loading needs no native `Function`-constructor interpreter.
2. **AOT compilation** — the FJS compiler generates Rust code that calls the
   `nanvm-lib` API, and rustc compiles it to native code. This path is the
   MVP pipeline and the bootstrap vehicle for compiling the FJS toolchain into
   the `nanvm` crate. It remains direct code generation: `Result` propagation
   and lazy-operand closures are acceptable; a Rust EDAG is not a required
   intermediate runtime representation. Future native targets are separate work.

Invariants:

- The two paths must agree on the specified observable results for their
  supported subset. On Rust both use `nanvm-lib` operators; shared operator
  tests cover that layer, while end-to-end fixtures cover linking, control
  flow, calls and errors. Native JS remains an independent reference, with
  the specified FJS function-text exception accounted for.
- A natively compiled function needs an **association with its semantic EDAG**
  when hashing or function-text operations require it. The EDAG is the stable
  **code/content identity** of a
  function; native code is a cached acceleration of it. It is not the
  allocation identity of a callable value. In a JS-compatible execution
  profile, two separately created function objects remain distinct under
  `===` even when their EDAGs and captured values are equal. A profile such
  as CAVM may deliberately use content identity only when that profile
  explicitly specifies the different identity semantics. This invariant is
  **staged**: the MVP generator omits the association. Embedded data versus
  out-of-band lookup remains open below. Until association and rendering are
  available, unsupported observations must be refused rather than produce
  placeholder function text. Metadata does not require a Rust EDAG executor.
- Direct AOT programs depend on VM objects and the effects they use. The
  optional Rust EDAG library depends on the VM, never the reverse; VM
  implementations need not supply their own EDAG. The self-hosted CLI embeds
  the AOT-compiled FJS interpreter because it loads source at runtime, while
  ordinary AOT programs need not include that interpreter.

#### Rust code generation: an output target of `fjs compile` (decided)

Shipped as the `.rs` output of `fjs compile`: one Rust **module** per compiled
program, not a `main`, so the same generated output serves the test harness,
self-hosting and AOT embedding. The decision and its rejected `fjs vm`
command group are recorded in
[fjs-nanvm-integration](../../todo/fjs-nanvm-integration.md#cli-an-output-target-not-a-command-group-decided).

#### Effects: the `nanvm-effects-node` runner crate (decided)

The compiler CLI is pure FJS that *returns* effect descriptions
(`Effect<NodeOp, T>`); all actual impurity lives in thin runner modules
(e.g. [`fjs/effects/node/module.mjs`](../../fjs/effects/node/module.mjs)),
which are not FJS and never pass through the code generator. Stage 1 of the
repository migration, complete, moved authored `.ts` / `.f.ts` to `.mjs` /
`.f.mjs` with JSDoc independently of compiler support, so `.f.mjs` is **not**
the compiled source marker. Once authored `.f.js` package support is complete,
compiler-supported `.f.mjs` modules may move to authored `.f.js`; `.f.js` is the
repository compiler-compatibility marker. The extension contract and migration
strategy are documented in [`fjs/fsc/README.md`](../../fjs/fsc/README.md).

Impure runner modules, authored as `.mjs`, remain outside the FJS compiler. A
native build therefore still needs a hand-written Rust twin interpreting the
same operation vocabulary against the OS (`std::fs`, `std::process`, stdio)
instead of Node built-ins.

The Rust twin of `fjs/effects/node` is the **`nanvm-effects-node`** library
crate — named to mirror the effect directory structure: this specific
effect set is the CLI-on-Node vocabulary, and future sets (e.g. a browser
set with `fetch`, DOM, and some shared effects) follow the same pattern.
It is a separate crate in the same workspace, published on crates.io:
`nanvm-lib` stays pure (no OS dependencies — keeping a future `no_std`
embedded profile open), and the `nanvm` binary depends on both. It serves
any AOT-compiled effectful FJS program, not just the embedded compiler —
it is to native FJS what `fjs/effects/node/module.mjs` is to Node FJS.

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
single-source pattern, after the [EDAG schema](../../fjs/edag/README.md) and
the operator tests. The stub is generated code: it is committed to the
repository and regenerated through the same single-script / drift-check
rules as the generated compiler source (see the distribution section
below).

Scoping notes:

- **Sync subset first.** The compiler CLI needs file read/write, console,
  and possibly `exec` — a blocking `std` implementation covers it. `Http`,
  `Fetch`, and parallel effects are where an async-runtime decision
  (tokio?) lurks; implement operations incrementally, driven by what the
  CLI actually exercises, and defer that decision entirely.
- **Module loading stays in FJS.** The
  [loader](../../fjs/fsc/todo/load-modules-without-import-effect.md) composes
  `ReadFile` / `ResolveFileModule`, parsing, linking and FJS interpretation.
  This workflow requires no `import` or native-function-construction effect;
  source `import` syntax remains supported. Existing host `import` consumers
  must be accounted for before removing that effect from the vocabulary.
- **`sandbox` is a low-level boundary.** Invoke a VM computation and capture
  its result or language throw, preserving the shared result/duration contract.
  This does not require replacing `Result` with panics, and error capture is
  separate from time/memory budgets or process isolation. Implementation tasks
  are in [nanvm-effects-node](../../todo/nanvm-effects-node.md).
- **Testing comes cheap.** The pure in-memory interpreters
  ([`fjs/effects/mock`](../../fjs/effects/mock),
  [`fjs/effects/node/virtual`](../../fjs/effects/node/virtual)) are `.f.mjs`
  since Stage 1. Once the
  compiler supports their complete syntax in Stage 2, rename them to `.f.js`;
  from that point they compile through the code generator unchanged, so the
  compiled CLI can run against in-memory effects with no Rust twins. The
  `nanvm-effects-node` runner can then be cross-checked against the pure
  interpreter operation by operation. The exception is
  [`fjs/effects/node/memory`](../../fjs/effects/node/memory) — the runner for
  the mutable memory effects (`MemOp`) — which is an impure `.mjs` module
  (mutable state, `node:crypto` UUIDs) and so joins the hand-written Rust
  twin set: implementing mutable memory effects in Rust is fine, same as
  the OS operations.

#### Distribution: one source, two packages (decided)

The compiler has a single source (FJS), shipped two ways:

- **npm** — FJS code only, running on Node/Deno; the `fjs` CLI as today.
- **crates.io** — the `nanvm` crate: the `nanvm-lib` runtime plus the
  generated Rust of the same compiler source (committed to the repository,
  see below), built by cargo into a native executable
  (see [console-program](./console-program.md)).

Crates.io never builds the crate itself: the published package is built by
every user's machine on `cargo install`, by docs.rs (sandboxed, **no
network**), and by offline/vendored downstream builds. So the published
`.crate` must build with nothing but cargo, rustc, and its declared
dependencies.

**Committed generation (decided):** the generated Rust of the compiler is
committed to git and adds no build dependencies for consumers. Cargo
packages it like any other source file — no `include` special-casing and no
`cargo publish --allow-dirty`, so cargo's VCS dirty check runs at full
strength and nothing uncommitted can ride into the `.crate`. The committed
copy is a **verified cache** of the generator's output, not a second
source: the CI drift check (the generated Node 26 job runs
`npm run gen`, then fails via `git add -A && git diff --cached
--exit-code` — see [fjs/ci](../../fjs/ci/README.md)) regenerates on every
PR and rejects any change whose committed output is stale, so the files can
neither drift nor be hand-edited unnoticed. Reviewers see the generated
diff alongside the generator change — for output whose contract is
byte-exactness, a direct correctness signal; mark the generated paths
`linguist-generated=true` in `.gitattributes` so the diffs stay collapsed
by default. The gitignored `_*` convention remains reserved for
*uncommitted* generated scratch, so the committed generated code lives in a
normally-named location chosen by the embedding crate. Each compiler invocation
produces one Rust file containing the linked source dependency graph.

This reverses the earlier publish-time-generation decision (gitignored
`_*` output packaged via `Cargo.toml`'s `include`, published with
`cargo publish --allow-dirty`). That arrangement predated the CI drift
check: without a drift gate, committed generated code could go stale — the
classic objection — while publish-time generation kept the repository
clean. With the drift check in place the balance flips: staleness is
mechanically excluded, whereas `--allow-dirty` waives the VCS check for
the *whole tree*, so any stray uncommitted file in the publish environment
would be packaged silently. Committing also makes a fresh checkout build
with cargo alone (no Node preinstalled), gives rust-analyzer and
`git bisect` real files at every commit, and turns the publish-time
reproducibility check into a continuous, per-PR one.

Rejected alternatives: publish-time-only generation (above); generating on
the fly in `build.rs` with a JS engine as a build dependency — Deno/V8
downloads binaries at build time, breaking docs.rs and offline builds, and
even a hermetic lightweight engine (QuickJS, Boa) would tax every consumer
with a third-party engine build and make build correctness depend on a
third engine.

**Developer workflow (decided):** regeneration is unconditional — the
developer entry point is "regenerate, then commit what changed", and the
generator writes a file only when its content actually changed, so a no-op
regeneration leaves mtimes untouched and cargo's fingerprinting skips the
rebuild. **One `package.json` script is the single regeneration entry
point for every generated file** — the `gen` contract already
required by generated CI (see [fjs/ci](../../fjs/ci/README.md)): today it
generates `.github/workflows/ci.yml`; the compiler Rust, the effects stub,
and any future generated files fold into the same script (possibly renamed
to something generation-neutral once it outgrows CI), so each new
generator is automatically covered by the whole-tree drift check with no
CI changes. There is deliberately **no `build.rs`**: sound staleness
detection would re-implement a build system inside a build script,
unconditional-but-cheap beats conditional-but-clever, and a crate without
a build script builds faster and is friendlier to consumers who audit or
restrict build-script execution — and with the generated sources
committed, a fresh checkout builds with cargo alone, no Node and no
pre-step, which also keeps plain `cargo build` / `cargo test` for
`nanvm-lib` development Node-free. Locally stale output cannot reach the
default branch: the drift check regenerates from scratch on every PR, and
the published `.crate` packages the same committed, check-verified files,
so consumers are never affected.

Dual shipping doubles as a permanent conformance test: both distributions
must emit **byte-identical** `.rs` output for the same input. With the
generated code committed, this reproducibility check is continuous — every
PR regenerates and diffs against the repository via the CI drift check,
rather than a publish-time-only gate — and anyone can regenerate from the
FJS source and diff against git. Once the crate ships, the check closes
into a fixed point: the crate-shipped compiler regenerates its own
packaged source, identically.

#### What changed (vs. the earlier serialized-EDAG proposal)

Previously the MVP pipeline sent a CBOR-serialized EDAG from `fjs` to a
`nanvm` executable, which required an EDAG wire-format spec, an FJS
serializer, and a Rust deserializer on the critical path. That interprocess
handoff is replaced by Rust code generation: rustc takes the place of the
deserializer. Serialization of `Any` values (binary encoding: **CBOR**,
[RFC 8949](https://www.rfc-editor.org/rfc/rfc8949), chosen for exact IEEE 754
doubles) is still wanted — for CAVM hashing, storage, and interchange — but
as a generic `Any` facility, post-MVP.

### Tasks

#### P1

The MVP pipeline's own tasks — the `.rs` generator, the harness, harness
export selection and the `.f.mjs` → `.f.js` repository migration — are
tracked in [fjs-nanvm-integration](../../todo/fjs-nanvm-integration.md#tasks).

- [x] **Test generation for operators** — one test-data module drives both
      the FJS proof (JS engine reference) and the generated Rust tests, so
      every new operator is tested once, not twice. Doubly important now: the
      shared operator layer is what keeps the interpreter and the generated
      code in agreement. See
      [`nanvm-lib/tests/README.md`](../tests/README.md).
- [x] **Complete all basic FunctionalScript operators** (Rust), including the
      short-circuit operators `&&`, `||`, `??` (lazy evaluation, like `?:`).
      Each operator arrives as cases in
      [`fjs/nanvm/module.f.mjs`](../../fjs/nanvm/module.f.mjs), which is what
      tests it on both sides.
      Current status: [operator tables in `nanvm-lib/README.md`](../README.md).
      Spec: [operators](../../spec/todo/2340-operators.md).
- [x] **LL(1) parser foundation** —
      [`fjs/fsc/parser`](../../fjs/fsc/parser/README.md) uses
      [`fjs/ebnf/ll1`](../../fjs/ebnf/ll1/README.md) and implements the
      source subset used by the walking skeleton. This does not mark the
      full language grammar complete. Named-import parsing is also
      implemented, and harness export selection completed the harness side.
      There is no separate unspecified parser gate.

#### P2

- [ ] **EDAG metadata integration** — use the canonical
      [`fjs/edag`](../../fjs/edag/README.md) schema for the staged association
      invariant above, resolving embedded data versus lookup before implementing
      that choice. Track native callable integration in
      [callable-function-objects](./callable-function-objects.md) Stage 7.
      This work does not require a Rust EDAG executor or generated Rust EDAG
      types; those belong to the deferred library below.
- [x] **Basic control operator `?:`** (Rust) — `Any::conditional`, its arms
      thunks so a compiled module establishes only the selected one, covered
      by the corpus as a `Group3`; the operator table in
      [`nanvm-lib/README.md`](../README.md) has the record.
- [x] **Nested functions** (function frame) (Rust).
      See [functions](../../spec/README.md#functions),
      [function-frame](../../spec/todo/3111-function-frame.md). The staged
      plan for making generated Rust function bodies callable — arguments,
      captured-frame, and self-reference representation — is
      [callable-function-objects](./callable-function-objects.md): a
      capturing closure is its Stage 3, landed; self-reference is Stage 5.
- [ ] **`nanvm-effects-node` crate** (Rust) — the effect runner: implements
      the generated stub trait against the OS; sync subset (fs, console)
      and `sandbox` first. Its schema, generated stub and conformance tasks
      are tracked in [nanvm-effects-node](../../todo/nanvm-effects-node.md).
      Required for the self-hosted CLI; no native module parser or import handler.

#### P3

- [ ] **FJS module loading and testing** — compose the parser/linker and existing
      interpreter in the [loader](../../fjs/fsc/todo/load-modules-without-import-effect.md),
      then use it for [proof loading](../../fjs/emergent_testing/todo/load-proofs-through-fjs.md)
      on Node and, as compiler coverage permits, AOT-compiled Rust.
- [ ] **Control statements**: `if`, `while`, etc. (Rust).
      See [`spec/todo/README.md` §3.2](../../spec/todo/README.md).
- [ ] **`Any` serialization (CBOR)** — generic serialization of `Any`
      values, which covers code as data; includes the deterministic profile
      needed for CAVM hashing (see open questions).

#### P4

- [ ] **Generators**, etc. (Rust).
- [ ] **Optional Rust EDAG library/EDSL** —
      [rust-edag](../../todo/rust-edag.md), **on hold, not planned for MVP**.
      A shared native executor and its
      [schema-generated types](../../fjs/edag/todo/rust-schema-codegen.md)
      may be explored later; neither blocks self-hosting.

### Post-MVP milestone: self-hosting

Compile the compiler, loader, interpreter and required testing logic (written
in FJS) to direct Rust with the code generator
and ship it as the `nanvm` crate
([console-program](./console-program.md)): a single native executable that
parses and runs supported FunctionalScript source — no Node/Deno, no rustc at
the user's run time. Its AOT-compiled FJS interpreter evaluates newly loaded
EDAG as data, with I/O and `sandbox` handled by `nanvm-effects-node`. Arbitrary
JavaScript and host modules are not part of the Rust source-loading contract.

Reached incrementally: Stage 1 removed authored TypeScript from the compiler
source into `.f.mjs` independently of parser coverage. Stage 2 also requires
removing host behavior outside FJS: the memo executor's captured mutable cache
needs an [immutable rewrite](../../fjs/edag/memo/todo/immutable-cache.md) preserving
sharing and lazy evaluation before native self-hosting. Host `Map` dependencies
in the compiler, analysis and executor also need
[container migration](../../fjs/fsc/todo/load-modules-without-import-effect.md#native-prerequisites)
or a separately approved language design. Both are semantic prerequisites, not
ordinary compiler coverage. As these migrations and language
coverage permit, compiler-supported modules move from `.f.mjs` to `.f.js`.

### Open questions

1. **Deterministic CBOR profile.** For content hashing (CAVM), the encoding
   must be canonical: one value, one byte sequence, one hash. RFC 8949 §4.2
   ("Core Deterministic Encoding") requires shortest-form integers and floats
   (a double that fits in a 16/32-bit float must be encoded shorter), which
   conflicts with "always 8-byte doubles". Do we adopt RFC 8949 §4.2 as-is,
   or define our own profile (e.g. always 64-bit floats)? Belongs to the
   `Any` serialization task (P3).
2. **Result printing beyond JSON.** Keep the harness's explicit JSON refusal
   for a selected value or call result that JSON cannot represent. Whether to
   add DJS output later remains open; serializing the entire export object is
   not a prerequisite for invoking one of its functions.
3. **Binary name.** The npm tool is `fjs`; the crate is `nanvm`. Should the
   crate's binary also be named `fjs` (same CLI surface, native), or `nanvm`?
4. **Embedded EDAG or a lookup effect.** The semantic association required
   above can be represented as embedded data or outside the function value,
   as [associate-edag-with-functions](../../fjs/fsc/todo/associate-edag-with-functions.md)
   proposes with `edagAdd` / `edagGet`. Which representation the runtime
   follows remains undecided; neither requires a dynamic Rust EDAG executor.

### Related

- [`spec/README.md`](../../spec/README.md) — the language spec;
  [`spec/todo/serialization.md`](../../spec/todo/serialization.md) records the
  EDAG-as-data decision and the two execution paths.
- [`fjs/fsc/README.md`](../../fjs/fsc/README.md) — source extension contract
  and incremental repository migration.
- [`fjs/edag`](../../fjs/edag/README.md) — the schema (RTTI) of the
  code-describing `Any`; optional Rust schema generation is tracked separately
  in [rust-schema-codegen](../../fjs/edag/todo/rust-schema-codegen.md).
- [fjs-nanvm-integration](../../todo/fjs-nanvm-integration.md) — the MVP
  definition and its tasks: the `.rs` output target and the harness.
- [console-program](./console-program.md) — the self-hosted `nanvm` crate
  (post-MVP).
- [`nanvm-lib/tests/README.md`](../tests/README.md) — the shared operator test
  data driving both the FJS proof and the generated Rust tests.
- [fs-vm-load-save](./fs-vm-load-save.md) — load/execute/save semantics.
