# 9. Serialization: EDAG as Data, not Bytecode

Formerly §9 of the main [spec README](../README.md).

**Decision:** the stable, canonical representation of functions is the **EDAG**, expressed as an
FJS value (`Any`). The code description is independent of its execution strategy
(see [functions](../README.md#functions); the exact shape is the RTTI schema in
[`fjs/edag`](../../fjs/edag/README.md)). It does not require every VM to implement
a native EDAG representation or interpreter. The reasons:

1. We need a canonical data representation of functions in FunctionalScript — and in the future
   content-addressable VM ([CAVM](./content-addressable-vm.md)) — to compute a hash.
2. The EDAG can be transformed back to source code. The adopted
   [function-source exception](../README.md#function-source-representation-exception)
   uses EDAG-derived code-only text for default function string conversion.
   Current source and runtime-value serializers have distinct contracts;
   broader callable interchange serialization remains open below.
3. Because code is an FJS value, serializing functions requires no separate format: once the VM
   serializes `Any` values, it serializes code too. The binary encoding of `Any` values is
   **CBOR** ([RFC 8949](https://www.rfc-editor.org/rfc/rfc8949)), chosen because it represents
   numbers as exact IEEE 754 doubles, avoiding the ambiguous binary↔decimal number conversion of
   text formats.

There are two execution paths, observably identical except in performance:

- **FJS interpretation** — the FJS interpreter executes the EDAG as data.
  Native self-hosting compiles this interpreter and the FJS loading pipeline to
  Rust ahead of time; loading a new module requires no native `import` or
  function-construction effect.
- **AOT compilation** — the FJS compiler generates Rust code that calls the `nanvm-lib` API, and
  rustc compiles it to native code: the bootstrap vehicle for compiling the FJS
  toolchain into `nanvm`. Ordinary AOT programs need no runtime EDAG executor
  or runtime code generation.

The [public FJS final-EDAG entry](../../fjs/compiler/todo/interpret-edag.md) owns the
[total-validation contract](../../todo/edag-stage1-discussion.md#5-validation)
for code supplied as data, including graphs the compiler would never emit.
Deferring the native `Function` constructor does not narrow that contract.

On Rust both paths use `nanvm-lib` operators, with shared operator tests covering
that layer and end-to-end tests covering the execution paths. The optional
[Rust EDAG library](../../todo/rust-edag.md) is deferred beyond MVP and is not
required for self-hosting. It would depend on the VM, never the reverse.

Future hashing and semantic metadata require an association with EDAG,
independently of the executor used: EDAG is the stable **code/content identity**,
while native code is a cached acceleration of it. Represented FJS values already
retain that EDAG; compiled native functions carry rendered text for conversion
without promising full semantic metadata retrieval. Native embedded `Any` data
versus out-of-band lookup remains open in the
[roadmap](../../nanvm-lib/todo/mvp-roadmap.md#open-questions). This metadata
requirement does not imply a dependency on the dynamic Rust EDAG library.

Code/content identity is not callable allocation identity. Under a JS-compatible execution
profile, separately created function objects remain separately allocated even when their EDAGs
and captured values are equal; sharing a hash does not make `f === g`. Profiles that deliberately
replace allocation identity with content identity, such as CAVM, must say so explicitly.

Bytecode is an advanced, performance-oriented representation that may vary across architectures,
VM implementations, and versions, while the EDAG is the stable representation. A VM implementation
has an option to transform the EDAG into its internal bytecode on loading — or to use the EDAG
itself as its byte code, interpreting it directly; internal bytecode is never used as an
interchange or storage format.

Since bytecode is VM-internal, it can be designed in the most flexible manner, allowing
for various kinds of optimizations in VM implementations. For example, bytecode that always copies
arguments of a function call to devoted stack slots (before the proper call instruction) disallows
optimization opportunities for calling well-known host (built-in) functions that can be implemented
without excessive copying / slot allocations.

1. [ ] [Call-like instructions](./9100-call-like-instructions.md) — VM-internal bytecode design.

## Function text and serialization

**Decision:** adopt EDAG-derived default function text as an explicit exception
to JavaScript result compatibility, as defined in the
[language principles](../README.md#function-source-representation-exception).
This is a shared conversion rule, not a special case for `String(entry)`.
Explicit `String(f)`, array/string conversion and property-key conversion use
it whenever their normal conversion path reaches the default representation
of an FJS function. The surrounding conversion rules do not change.

The exception includes the consequences of the resulting text, such as a
changed lookup key or branch, and source-text reflection through exports.
It does not justify unrelated value differences, change function allocation
identity or arity, or require the original source spelling to be retained.
A JavaScript host still uses its own representation when executing source
or ordinary runtime callables after reflection-erasing compilation; this
decision does not patch its built-ins. Amnesia, memo and compiler
initialization use represented functions and the shared canonical renderer.

### Open questions

Current implementations have distinct contracts. Default function text is
code-only, with captured values represented by slot names. The total renderer
may emit JavaScript outside the FJS source grammar. The source serializer
instead preserves a structural FJS round trip within its supported profile.
Runtime value compilation materializes captured values separately and
preserves their supported sharing and identity. See
[function text](../../fjs/edag/function-text.md) and
[runtime compilation](../../fjs/edag/values.md#runtime-compilation).
The questions below record these implemented answers and the remaining
broader callable serialization work.

1. **Should the compiler's function serializer and `String(f)` be the same function?**

   **Answered for the current APIs: distinct contracts sharing rendering
   machinery.** `String(f)` represents code and promises no self-contained
   callable round trip. Source serialization and runtime-value compilation
   have the separate profiles above. A future interchange serializer's
   interface and guarantees remain open. Here “function serializer” means
   source serialization of a callable value, not EDAG-as-data encoding such
   as DataJS or the planned CBOR format.

2. **Should `String(f)` instantiate the captured frame?**

   **Answered for `String(f)`: code-only** (approved by @sasha-gil on
   2026-09-30, [recorded on #2418](https://github.com/functionalscript/functionalscript/pull/2418)). A captured
   value is written as its slot's name, so every function one arrow makes has
   one text; see
   [to-primitive's D2](../../nanvm-lib/todo/to-primitive.md#stage-3-a-functions-text).
   What the function serializer does with a frame stays with question 1. The
   discussion below is kept for that.

   ```js
   const x = 3;
   const f = () => x;
   ```

   Source lowering may inline a known primitive capture into the body, so
   this example can render as `()=>3` without instantiating a captured frame.

   Should the function serializer produce `() => x` or `() => 3`
   (illustrative spellings)? A self-contained serializer must represent
   captured values rather than leave them as unresolved external bindings,
   which gives `3` in this example. `String(f)` does not follow it: its
   code-only answer above stands whatever question 1 decides. A code-only
   representation cannot promise recovery of the original variable name
   from a name-erased EDAG.

   The distinction is code versus a bound callable:

   ```js
   const make = a => () => a;
   const x0 = make(0);
   const x1 = make(1);
   ```

   In ordinary JavaScript these closures have the same function text but
   different captured values: `x0()` is `0`, `x1()` is `1`. A callable
   serializer must represent that difference; `() => 0` and `() => 1` are
   illustrative outputs, not chosen canonical spellings. Equal rendered text
   does not by itself establish function identity: separate allocations with
   the same code and captures may still be distinct in the selected profile.

   Frame instantiation is not unrestricted textual substitution. For example,
   with `const x = []; const f = () => x;`, writing `() => []` would allocate
   a new array on each call instead of returning the captured array. A callable
   serializer must preserve the sharing and identity required by its profile;
   choosing how to carry the frame is part of this question.

3. **How should the function serializer and `String(f)` handle `self`?**

   **Implemented:** code-only text renders a function reading `self` as a
   named function expression, with a generated self binding allocated before
   its parameters. FJS source serialization uses a generated `const` whose
   initializer references that binding. Nested functions capture the correct
   enclosing function. The named expression belongs to rendered JavaScript
   text; it adds no syntax to the FJS parser
   ([function text](../../fjs/edag/function-text.md#a-function-that-names-itself)).

   ```js
   const f = () => f;
   ```

   A callable round trip for this example must retain self-reference:
   `restored() === restored`. Expanding the function again at each `self`
   would not provide a finite representation. Nested functions and captured
   references to an enclosing function must keep the correct binding too.

Earlier sketches that identify `toString(f)` with a closed callable serializer
or materialize every frame — including
[EDAG stage 1, source printing](../../todo/edag-stage1-discussion.md) — do not
supersede the current code-only and finite-`self` answers. Broader interchange
guarantees remain open; they do not reopen these implemented spellings or
change EDAG `frame`/`self` semantics.

### Conditional requirement: lazy frame rendering

`String(f)` is code-only (question 2), so it never instantiates a frame and
this requirement does not apply to it. It stays for a function serializer
that represents captured values (question 1).

**If a future callable serializer instantiates the frame, its FJS VM
implementation must support lazy source production.** Current source and
runtime-value emitters produce complete text; this deferred streaming design
is not implemented. A small function can capture other functions and,
through their frames, a large dependency graph. Do not precompute or retain the
complete reconstructed source as part of every function value.

Keep the semantic EDAG and captured frame as the source of the representation.
Creating or calling a function does not by itself render its text. Merely
postponing all work until serialization is called is not enough: producing
that string value must not require eagerly materializing the entire source
either. The VM can
represent it internally as deferred text, generating code units or chunks as
consumers demand them. It remains an ordinary string to FJS code, not a new
promise, iterator or user-visible lazy object. Ropes, chunking and caching are
implementation choices, not a selected representation here.

Preserve shared dependencies rather than recursively expanding a DAG into a
duplicated tree. Laziness avoids unnecessary materialization; preserving
sharing avoids unnecessary output growth. The renderer must also preserve the
profile's captured-value identity and finite `self` representation, according
to the answers above. Laziness does not choose those answers.

The string's contents depend on stable semantic inputs and the specified
rendering contract, never on consumption order, optimization progress or cache
state. Caching is optional, not a requirement to keep the whole source alive.
Operations such as length, comparison or hashing may still require substantial
traversal; emitting all text necessarily produces all of it. No constant-time
or universal memory bound is implied. Resource interruption follows the
existing failure contract.

A streaming function serializer and `String(f)` may share an incremental
renderer without sharing an interface or a reconstruction guarantee. This
constraint governs the future serializer's frame production; `String(f)`
keeps its implemented code-only contract. It specifies the
implementation requirement if future callable frame serialization is chosen;
it does not claim lazy strings or frame serialization are implemented today.

### Implementation follow-through

- [x] Specify code-only default text, capture-slot names and finite `self`
  rendering, independently of callable reconstruction. Source and value
  serializers retain distinct contracts.
- [x] Share deterministic rendering of admitted bodies across represented
  FJS executors and coercion paths; compiled native functions carry the
  same EDAG-derived text. Render semantic code, not optimization/cache state.
- [x] Prove represented direct/indirect conversion and implemented source
  round trips, including captures and `self`: see
  [conversion proofs](../../fjs/edag/value/convert/proof.f.mjs) and
  [serializer proofs](../../fjs/compiler/serializer/proof.f.mjs).
- [ ] Specify broader callable/interchange serialization guarantees,
  including the supported captured-sharing and `self` round trips.
- [ ] If a function serializer instantiates the frame (question 1; `String(f)`
  does not, per question 2), implement deferred text
  production and incremental consumption without storing complete source on
  function values. Cover large shared dependency graphs, prefix-only use and
  full consumption; compare produced code units and admitted string operations
  with a fully materialized reference, independently of caches and chunking.
- [ ] Complete remaining native conversion corpus cases, including a
  function used as a property key, as tracked in
  [member-functions](../../nanvm-lib/todo/member-functions.md). Native semantic
  EDAG association remains [separate](../../fjs/compiler/todo/associate-edag-with-functions.md)
  from the compiled function text already supplied.

Failure to follow the adopted contract is P1. Merely differing from authored
JavaScript function text is the approved exception, not an unresolved defect
or a reason to ban function exports. Unsupported capabilities remain explicit.

## Byte Code Structures

VM-internal sketches; not part of the stable serializable format.

```rust
struct Array<T> {
    len: u32,
    array: [T; self.len],
}

type String = Array<u16>;

// LSB first.
type BigUInt = Array<u64>;

type Object = Array<(String, Any)>;

// The in-memory code of a function (VM-internal).
type Code = Array<u8>;

struct Function {
    length: u32,
    code: Code,
}

// Not for serialization — a parser resolves all imports.
struct Module {
    import: Array<String>,
    code: Code,
}
```
