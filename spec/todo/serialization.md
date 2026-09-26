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
   uses EDAG-derived text for default function string conversion; whether
   that operation is also the FSC function serializer is open below.
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

On Rust both paths use `nanvm-lib` operators, with shared operator tests covering
that layer and end-to-end tests covering the execution paths. The optional
[Rust EDAG library](../../todo/rust-edag.md) is deferred beyond MVP and is not
required for self-hosting. It would depend on the VM, never the reverse.

Hashing and function text require an association with semantic EDAG, independently
of the executor used: the EDAG is the stable **code/content identity**, while
native code is a cached acceleration of it. Embedded `Any` data versus out-of-band
lookup remains open in the
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
outside the FJS VM; this decision does not patch its built-ins.

### Open questions

These questions are deliberately open, not implementation instructions with
an implicit answer. Captures are in the language
([functions](../README.md#functions)); the examples do not claim current
compiler support for `self` or for rendering either as text.

1. **Should the FSC function serializer and `String(f)` be the same function?**
   Should they have one output contract and implementation, or distinct
   contracts that may share rendering machinery? In particular, does `String(f)`
   promise self-contained source that reconstructs the callable value,
   or only a source representation of its code? Sharing EDAG as input does not
   by itself decide this. Here “function serializer” means source serialization
   of a callable value, not EDAG-as-data encoding such as DataJS or the planned CBOR format.

2. **Should `String(f)` instantiate the captured frame?**

   ```js
   const x = 3;
   const f = () => x;
   ```

   Should it produce `() => x` or `() => 3` (illustrative spellings)? The
   **owner's preference is `() => 3`**. If question 1 chooses the same
   self-contained function serializer for both operations, captured values
   must be represented rather than left as unresolved external bindings;
   that gives `3` in this example. Until question 1 is answered, the choice
   for `String(f)` remains open. A code-only representation cannot promise
   recovery of the original variable name from a name-erased EDAG.

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
   How is the current function referenced in finite source, both for recursive
   calls and when `self` is returned as a value? Does each operation use a
   generated binding, a wrapper, a named-function form, or another admitted
   representation? No spelling is selected here, and a named-function candidate
   does not add that syntax to FJS automatically.

   ```js
   const f = () => f;
   ```

   A callable round trip for this example must retain self-reference:
   `restored() === restored`. Expanding the function again at each `self`
   would not provide a finite representation. Nested functions and captured
   references to an enclosing function must keep the correct binding too.

Earlier sketches that identify `toString(f)` with a closed callable serializer,
materialize every frame or choose a named function for `self` — including
[EDAG stage 1, source printing](../../todo/edag-stage1-discussion.md) — are
candidates, not answers to these reopened questions. The questions change no
EDAG `frame`/`self` semantics and no current serializer implementation.

### Conditional requirement: lazy frame rendering

**If `String(f)` instantiates the frame, its FJS VM implementation must support
lazy source production.** A small function can capture other functions and,
through their frames, a large dependency graph. Do not precompute or retain the
complete reconstructed source as part of every function value.

Keep the semantic EDAG and captured frame as the source of the representation.
Creating or calling a function does not by itself render its text. Merely
postponing all work until `String(f)` is called is not enough: producing that string value
must not require eagerly materializing the entire source either. The VM can
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
constraint does not decide whether the two have identical contents (question 1)
or whether `String(f)` includes the frame at all (question 2). It specifies the
implementation requirement if frame inclusion is chosen; it does not claim
lazy strings or frame serialization are implemented today.

### Implementation follow-through

- [ ] Resolve each question before implementing the cases whose observable
  output depends on it; do not make unrelated work wait on all three.
- [ ] Specify deterministic rendering for the chosen inputs and share the
  default function-representation operation across FJS executors and coercion
  paths. Render associated semantic EDAG, not mutable optimization/cache state.
- [ ] If frame-instantiating `String(f)` is selected, implement deferred text
  production and incremental consumption without storing complete source on
  function values. Cover large shared dependency graphs, prefix-only use and
  full consumption; compare produced code units and admitted string operations
  with a fully materialized reference, independently of caches and chunking.
- [ ] Test direct and indirect conversion, helper functions and exports against
  that contract. Test callable round trips with captured sharing and `self`
  where promised; do not assume that `String(f)` promises the same round trip
  before question 1 is answered.

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
