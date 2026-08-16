# 9. Serialization: AST as Data, not Bytecode

Formerly §9 of the main [spec README](../README.md).

**Decision:** the stable, canonical representation of functions is the **AST**, expressed as an
FJS value (`Any`). Code is data: the `Function` constructor accepts an `Any` that describes the
code, and the VM knows how to execute it (see [function](./3110-function.md); the exact shape
is specified by the [ast-spec](../../todo/ast-spec.md)). The reasons:

1. We need a canonical data representation of functions in FunctionalScript — and in the future
   content-addressable VM ([CAVM](./content-addressable-vm.md)) — to compute a hash.
2. The AST can be transformed back to source code; this transformation will be used in
   `toString(f)`.
3. Because code is an FJS value, serializing functions requires no separate format: once the VM
   serializes `Any` values, it serializes code too. The binary encoding of `Any` values is
   **CBOR** ([RFC 8949](https://www.rfc-editor.org/rfc/rfc8949)), chosen because it represents
   numbers as exact IEEE 754 doubles, avoiding the ambiguous binary↔decimal number conversion of
   text formats.

There are two execution paths, observably identical except in performance:

- **Interpretation** — the `Function` constructor executes the `Any` code description directly:
  the baseline path, required for the self-hosted `nanvm` and for code constructed at run time.
- **AOT compilation** — the FJS compiler generates Rust code that calls the `nanvm-lib` API, and
  rustc compiles it to native code: the bootstrap vehicle for compiling the compiler itself into
  `nanvm`, and the backend for platforms where interpretation is undesirable or JIT is forbidden
  (e.g. iOS, embedded).

Both paths bottom out in the same `nanvm-lib` operators, so shared operator tests cover their
common layer. A natively compiled function still carries its `Any` code description (as static
data), so hashing and `toString(f)` apply uniformly to all functions: the AST is the identity of
a function; native code is a cached acceleration of it.

Bytecode is an advanced, performance-oriented representation that may vary across architectures,
VM implementations, and versions, while the AST is the stable representation. A VM implementation
has an option to transform the AST into its internal bytecode on loading — or to use the AST
itself as its byte code, interpreting it directly; internal bytecode is never used as an
interchange or storage format.

Since bytecode is VM-internal, it can be designed in the most flexible manner, allowing
for various kinds of optimizations in VM implementations. For example, bytecode that always copies
arguments of a function call to devoted stack slots (before the proper call instruction) disallows
optimization opportunities for calling well-known host (built-in) functions that can be implemented
without excessive copying / slot allocations.

1. [ ] [Call-like instructions](./9100-call-like-instructions.md) — VM-internal bytecode design.

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
