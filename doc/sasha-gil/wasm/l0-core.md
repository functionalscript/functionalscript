# L0: the core

The core describes the FunctionalScript data model, not JavaScript. Values
are immutable and come in a few kinds: numbers, booleans, `undefined` and
`null`, strings, bigints, arrays, ordered objects and functions. L0 is how a
module makes, reads, shares, frees and calls them. The sections below name
24 functions, and L0 should stay near that size: a new one needs a reason
that L1 cannot serve.

Every section below is a **proposal**, with the options considered.

[l0-design.md](./l0-design.md) picks one option on each axis, as a first
detailed design for discussion.

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

**Decided (2026-11-02):** L0 does not choose a boxing. A value at the
boundary is an opaque `any`, and the runtime alone knows its encoding.
Programs work with typed, unpacked values wherever the compiler knows the
type.

- **Opaque `any`.** NaN-boxing, handles, WasmGC references and hashes are
  all legal encodings. The choice belongs to the runtime, so NaNVM's
  NaN-boxing stays NaNVM's.
- **Typed values.** `kind(any)` answers the kind. `to_f64`, `to_bool` and
  their inverses `from_f64`, `from_bool` convert between `any` and a plain
  WASM value. `undefined()` and `null()` answer those two values, since only
  the runtime knows their encoding. A string, a bigint, an array, an object or a function stays an
  opaque reference, but one whose kind is known, so later operations on it
  skip the dispatch.
- **Unpack once.** Values are immutable, so a value's kind never changes.
  The compiler unpacks a value once and keeps the typed form in a local for
  as long as the value is in scope. The EDAG already shares nodes, which is
  where "once" comes from.

### Costs

1. **Repacking where a value escapes.** Arguments, array items, object
   properties and results are `any`. Within one function, tail loops
   included, values stay typed; across a call they are packed and the callee
   unpacks again.
2. **Packing may allocate.** `from_f64` is free for a NaN-boxing runtime and
   an allocation plus a later `drop` for a handle runtime. The program cannot
   tell which.
3. **Calls across modules.** Without type knowledge, `a + b` is two unpacks,
   an add and a pack, and engines do not reliably inline calls between
   modules. The first code generator can work this way. An unboxing pass over
   the EDAG, which infers which values are numbers, removes most of the cost
   later without changing the ABI.

### The WASM type of `any`

A signature still needs a WASM type for `any`.

| Option | Fits |
| --- | --- |
| `i64` | NaN-boxing, pointers, table indices. Its bits survive everywhere, unlike a NaN payload in an `f64`, which WASM arithmetic and a JavaScript host need not keep. Crosses to JavaScript as a `BigInt`. |
| `i32` | Handles and pointers into one linear memory. |
| `externref` or WasmGC `anyref` | A JavaScript host or a WasmGC runtime. Outside what `fjs/media/wasm` covers today. |

**Open:** whether the ABI fixes one, or whether it is a parameter of code
generation chosen per target runtime. We generate the program, so the
parameter costs little; the price is one compiled program per family of
runtimes.

## Allocation

Values are immutable, so allocation and initialisation can be one step.

- **Byte containers.** Copied from linear memory, which is how literals in
  data segments get in. A string of UTF-16 units is
  `make_string(ptr, len)`, and a bigint is `make_bigint(sign, ptr, len)`,
  with `len` counting its `u64` words. A bigint needs its own call because
  its sign is a header the string has no place for.
- **Value containers.** An array, an object or a frame is built: `begin`
  with a kind and a length, `push` once per item, then `seal`, which returns
  the value. After `seal` the value never changes. This matches
  `IContainer::new` taking an iterator, and the local-mutation stage of
  [mutability.md](../../../spec/design/mutability.md).
- **Reads.** `kind(v)`, `length(v)`, `item(v, i)`, for an object
  `key(v, i)`, and for a bigint `sign(v)`, the header `make_bigint` took.
  Bytes are copied out with `read_units(v, start, len, ptr)`.

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
| Reference counting: `dup` and `drop`, arguments borrowed, results owned | Frees memory, as NaNVM's `Rc` does today | Emits `drop` at last use. That needs an ownership and last-use analysis over the EDAG, which no pass does today: preparation does not choose value owners |
| An arena per run, where `drop` does nothing | Trivial | Same code as the row above |
| WasmGC | Nothing to do | No `dup` or `drop`; needs `any` to be a reference type |

**Proposed:** `dup` and `drop` in the ABI, with borrowed arguments and owned
results, and a new ownership analysis in the compiler to place them. An arena runtime is then a legal runtime whose `drop` does nothing,
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
- **Text:** `text(f)` answers the text `make_function` took, as a string, or
  `undefined` when it took none, so `String(f)` can refuse it as
  `IFunction::text` does today.

**Open:** a function's text, what `String(f)` answers, is the most
JavaScript-flavoured item in L0. It could move to L1 as metadata looked up
by code index.

## Errors

| Option | Notes |
| --- | --- |
| A multi-value result, an `i32` status and an `any` | WASM 2.0, which the existing writer supports. It is `Result<Any, Any>` spelled out, at the cost of one branch after each call. |
| A reserved error bit in `any` | Saves a result, but takes a bit of every runtime's encoding, which L0 no longer chooses. |
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
