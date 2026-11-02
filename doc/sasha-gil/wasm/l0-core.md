# L0: the core

The core describes the FunctionalScript data model, not JavaScript. Values
are immutable and come in a few kinds: numbers, booleans, `undefined` and
`null`, strings, bigints, arrays, ordered objects and functions. L0 is how a
module makes, reads, shares, frees and calls them. It should stay at about
15 functions.

Every section below is a **proposal**, with the options considered.

## Today

| Concept | Rust today |
| --- | --- |
| Value | `Any<A>`, unpacked into `Unpacked<A>` |
| Containers | `IContainer`: a header and items. A string is `u16` units, a bigint a `Sign` and `u64` words, an object `Property` items, an array `Any` items |
| Function | `IFunction`: `call`, `length`, `text`. Made by `IVm::static_function` from a `StaticCode` and a frame |
| Frame | `IVm::frame`, read as `A::frame(_self)[i]` |
| Identity | `IComplex::ptr_eq` |
| Errors | `Result<Any<A>, Any<A>>` |

Sources: [`vm/internal`](../../../nanvm/lib/src/vm/internal/mod.rs),
[`istatic_function.rs`](../../../nanvm/lib/src/vm/internal/istatic_function.rs).

## Values

One value crosses the boundary as one WASM value.

| Option | For | Against |
| --- | --- | --- |
| An `i64` word: immediates fixed, references opaque | Numbers, booleans and nullish values cross with no allocation. Generated code can inline `f64` fast paths later. Matches NaN-boxing. | Fixes part of the encoding in the ABI. A WasmGC runtime needs a side table for references. |
| An `i32` handle for every value | Fully opaque: a runtime can do anything. | Every number is a handle, and arithmetic becomes a call plus an allocation. |
| `externref` or WasmGC `anyref` | The host GC manages memory, and host interop is natural. | Numbers must be boxed (only `i31ref` is free). Ties every runtime to WasmGC, which `fjs/media/wasm` does not cover. |

**Proposed:** an `i64` word. The ABI fixes the encoding of a number, a
boolean, `undefined` and `null`. The payload of a reference is opaque: the
runtime decides whether it is a pointer, a table index or a hash.

`i64` is preferred to `f64` for the bits of a boxed reference, which are a
NaN payload. WASM keeps those bits through locals, memory, calls and
`reinterpret`, but not through arithmetic: an `f64` operation that returns a
NaN may return any NaN. A JavaScript host is looser still: when an `f64`
crosses to JavaScript as a `Number`, the engine need not keep the payload,
so a runtime written in JavaScript could lose a reference. As an `i64`, the
word crosses as a `BigInt`, exact but slower. The cost of `i64` inside WASM
is one `reinterpret` before and after each number operation, which is free.

## Allocation

Values are immutable, so allocation and initialisation can be one step.

- **Byte containers.** A string of UTF-16 units or a bigint of sign and
  `u64` words is copied from linear memory: `make_string(ptr, len)`. This is
  how literals in data segments get in.
- **Value containers.** An array, an object or a frame is built: `begin`
  with a kind and a length, `push` once per item, then `seal`, which returns
  the value. After `seal` the value never changes. This matches
  `IContainer::new` taking an iterator, and the local-mutation stage of
  [mutability.md](../../../spec/design/mutability.md).
- **Reads.** `kind(v)`, `length(v)`, `item(v, i)`, and for an object
  `key(v, i)`. Bytes are copied out with `read_units(v, start, len, ptr)`.

**Open:** a string of UTF-16 units could count as JavaScript-specific. The
proposal keeps it in L0 because `length`, indexing and `charCodeAt` are
defined on UTF-16 units, and hiding them would move every string operation
into L1.

## Lifetime

The heap is acyclic today. A function names itself through its `self_`,
never through its frame, and mutual recursion between `const` declarations
is refused
([3140-forward-references.md](../../../spec/todo/3140-forward-references.md)).
Reference counting is therefore sound without a cycle collector.

| Option | Runtime | Program |
| --- | --- | --- |
| Reference counting: `dup` and `drop`, arguments borrowed, results owned | Frees memory, as NaNVM's `Rc` does today | Emits `drop` at last use, which the prepare pass already tracks as invocation lifetimes |
| An arena per run, where `drop` does nothing | Trivial | Same code as the row above |
| WasmGC | Nothing to do | No `dup` or `drop`, but rules out the `i64` word |

**Proposed:** `dup` and `drop` in the ABI, with borrowed arguments and owned
results. An arena runtime is then a legal runtime whose `drop` does nothing,
which is the cheapest start for an alternative runtime.

**Risk:** the proposed object-grouping forward references,
`const x = { a: () => x.b() }`, would create cycles through a frame. If that
proposal is accepted, this choice is revisited.

## Calls and returns

A function is code plus a frame, a `length`, and optionally its text. The
code is an entry in a function table that program and runtime share.

- **Make:** `make_function(code_index, frame, length, text_ptr, text_len)`.
- **Call:** `call(f, args)` returns a status and a value. The runtime calls
  the code through `call_indirect` on the shared table, passing `self` and
  `args`. A program and a runtime call each other the same way, which
  callbacks need.
- **Arguments:** a sealed array, as `StaticCode` takes today. Simple, and
  rest parameters come free, at the cost of one allocation per call. A
  fixed-arity fast path can be added later without breaking this one.
- **Frame:** `frame(self, i)`.

**Open:** a function's text, what `String(f)` answers, is the most
JavaScript-flavoured item in L0. It could move to L1 as metadata looked up
by code index.

## Errors

| Option | Notes |
| --- | --- |
| A multi-value result, an `i32` status and an `i64` value | WASM 2.0, which the existing writer supports. It is `Result<Any, Any>` spelled out, at the cost of one branch after each call. |
| A reserved error bit in the word | Saves a result, but every check of a value has to mask it. |
| WASM exception handling, `try_table` and tags | No branch on success, but WASM 3.0, outside the scope of `fjs/media/wasm`, and Rust supports it only behind a flag. |

**Proposed:** the multi-value result now. Exception handling can come later
as a second calling convention.

## Identity

`same(a, b)` answers reference identity, as `ptr_eq` does.

**Open:** a content-addressable runtime
([content-addressable-vm.md](../../../spec/design/content-addressable-vm.md))
would answer structural identity. Is that an allowed difference between
runtimes, or must `Object.is` on two equal fresh arrays answer `false` on
every runtime?
