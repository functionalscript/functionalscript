# L0: a first detailed design

This draft turns the options in [l0-core.md](./l0-core.md) into one concrete
design, for discussion. It follows the decisions already recorded in the
[README](./README.md#decisions): a separate L1, no boxing chosen by L0, and
our own linker. Nothing here is decided yet.

## Summary

L0 is 26 imported functions and 4 imported constants in one import module,
`fjs:l0`. A value is an opaque `i64`. Bytes cross through a memory both
modules share. Containers are built through a builder handle and then sealed,
values are reference counted, and a call returns a status and a value.

| Group | Imports | WASM signature |
| --- | --- | --- |
| Constants | `undefined`, `null`, `true`, `false` | immutable `i64` globals |
| Scalars | `kind` | `(v) -> i32` |
| | `to_f64`, `from_f64` | `(v) -> f64`, `(f64) -> any` |
| | `to_bool`, `from_bool` | `(v) -> i32`, `(i32) -> any` |
| Bytes | `make_string` | `(ptr, len) -> any`, UTF-16 units |
| | `read_units` | `(s, start, len, ptr)` |
| | `make_bigint` | `(sign, ptr, len) -> any`, `u64` words |
| | `sign`, `read_words` | `(b) -> i32`, `(b, start, len, ptr)` |
| Containers | `begin_array`, `begin_object` | `(len) -> builder` |
| | `push`, `push_property` | `(builder, v)`, `(builder, key, v)` |
| | `seal` | `(builder) -> any` |
| | `length`, `item`, `key` | `(v) -> i32`, `(v, i) -> any`, `(o, i) -> any` |
| | `find` | `(o, key) -> i32`, the index or -1 |
| Lifetime | `dup`, `drop` | `(v) -> any`, `(v)` |
| Functions | `make_function` | `(code, frame, length, text) -> any` |
| | `call` | `(f, args) -> (i32, any)` |
| | `frame`, `text` | `(self, i) -> any`, `(f) -> any` |
| Identity | `same` | `(a, b) -> i32` |

`kind` answers a fixed tag: 0 `undefined`, 1 `null`, 2 boolean, 3 number,
4 string, 5 bigint, 6 array, 7 object, 8 function. The tags are part of the
ABI version, so a program and a runtime built apart agree on them.

Every value, as an argument or a result, is an `i64`. `ptr`, `len`,
`start`, `i`, `sign`, `code`, `length` and `builder` are `i32`.

## Design choices

Each choice gives the pick first, then the alternatives and the reason.

### 1. The WASM type of `any`: `i64`, fixed for ABI version 1

- **Alternatives:** `i32` handles; `externref` or WasmGC `anyref`; a type
  chosen per runtime when code is generated.
- **Why:** `i64` holds a NaN-boxed value, a pointer or a handle, and its bits
  survive WASM and a JavaScript host. A per-runtime type stays possible as a
  later ABI version, so we don't pay for it before a second runtime needs it.

### 2. Typed values exist only in the compiler

- **Pick:** a number unpacks to `f64` and a boolean to `i32`. A string,
  bigint, array, object or function stays an `i64` whose kind the compiler
  knows. There are no WASM types for typed references.
- **Alternative:** a typed handle per kind, for example an `i32` string
  handle.
- **Why:** typed handles double the API. Immutability already lets the
  compiler skip `kind` once it knows a value's kind.

### 3. Constants: imported immutable globals

- **Pick:** `undefined`, `null`, `true` and `false` are imported globals, such
  as `(global (import "fjs:l0" "undefined") i64)`.
- **Alternative:** functions with no arguments.
- **Why:** reading a global costs nothing, the engine can fold it, and only
  the runtime knows the bits.

### 4. Numbers: the runtime canonicalises NaN

- **Pick:** `from_f64` may change a NaN's payload, and `to_f64` returns some
  NaN for a NaN.
- **Why:** a NaN-boxing runtime has to, and no FJS program can tell two NaNs
  apart.

### 5. Memory and table: made by the loader, imported by both modules

- **Pick:** the host makes one `Memory` and one funcref `Table` and passes
  both to the runtime and to the program. The program's data and element
  segments go at offsets given by imported globals, `data_base` and
  `table_base`. The program's region also holds the scratch space that
  `read_units` and `read_words` write into. The runtime owns everything
  outside that region.
- **Alternatives:** the runtime exports its memory and the program imports
  it; multi-memory (WASM 3.0); no shared memory, with a string passed one unit
  per call.
- **Why:** this works the same for a WASM runtime and a JavaScript runtime,
  and needs only WASM 2.0. The program states its sizes in a custom section,
  `fjs.layout`, so the loader can reserve them before instantiating it. Its
  payload is three unsigned LEB128 numbers, in this order: the size of the
  data segments in bytes, the size of the scratch space in bytes, and the
  number of table entries.

### 6. Literals: built once at start-up

- **Pick:** the program's start function builds every literal string, bigint
  and constant container once and keeps it in a mutable global of its own.
  These values are never dropped.
- **Alternative:** build a literal each time it is used.
- **Why:** a literal in a loop costs one `global.get`, not an allocation.

### 7. Strings: UTF-16 units in L0

- **Pick:** `make_string` and `read_units` move UTF-16 units, and `length`
  counts units.
- **Alternative:** opaque strings, with every string operation in L1.
- **Why:** `length`, indexing and `charCodeAt` are defined on units, and
  hiding the units moves every string operation into L1. Inside, a runtime may
  still store strings as UTF-8 or as ropes.

### 8. Containers: a builder handle, then seal

- **Pick:** `begin_array(len)` or `begin_object(len)` returns an `i32`
  builder, `push` or `push_property` adds one item, and `seal` returns the
  value. Builders nest, so a frame or an argument list can be built while
  another builder is open. Pushing more or fewer items than `len`, or using a
  sealed builder, traps.
- **Alternative:** the program writes `i64` items into memory and one call
  copies them. That needs a shadow stack in the program.
- **Why:** version 1 then needs no memory protocol for values. The bulk call
  can be added later as a faster path beside this one.

### 9. Objects: the runtime keeps keys unique and ordered

- **Pick:** keys are strings. `seal` keeps the first position and the last
  value of a repeated key, as the literal `{ a: 1, a: 2 }` does.
  `find(o, key)` returns the index or -1, so a runtime may index an object by
  hash.
- **Why:** lookup belongs with the representation. What `o.x` means,
  including members and the rules for `__proto__`, stays in L1.

### 10. Lifetime: reference counting, borrowed arguments, owned results

- **Pick:** an L0 function borrows its value arguments, with four
  exceptions. `push` and `push_property` take ownership of the values they
  store, `make_function` of its frame and text, and `drop` of its argument.
  `seal` consumes its builder. Every returned value is owned, so `item`,
  `key` and `frame` return a `dup`. The program emits `drop` at a value's
  last use.
- **Alternatives:** an arena, where `drop` does nothing, is legal under the
  same ABI. WasmGC would need no `dup` or `drop`.
- **Why:** this matches NaNVM's `Rc` today, and the heap is acyclic. The cost
  is a new ownership pass in the compiler.

### 11. Misuse traps, and only calls fail

- **Pick:** L0 functions have preconditions. For example, `to_f64` on a
  string or `item` past the end reaches `unreachable`, and running out of
  memory traps. Only `call` returns a status.
- **Alternative:** a status from every L0 function.
- **Why:** L0 stays unchecked and fast. L1 checks types and throws the
  JavaScript errors, such as `TypeError`.

### 12. Functions: a code index, a frame, a length and a text

- **Pick:** all code has one type,
  `(param $self i64) (param $args i64) (result i32 i64)`, and borrows `self`
  and `args`. `make_function(code, frame, length, text)` takes a sealed frame
  array, and the text as a string or `undefined`. `length(f)` answers the
  declared parameter count. `call(f, args)` takes a sealed array of
  arguments.
- **Alternative:** the program reads a function's code index and calls
  through the shared table itself. That is faster, but a JavaScript runtime
  cannot put its own functions in a WASM table. So the direct call is an
  [inline fragment](./inline-fragments.md) for a WASM runtime, not part of L0.
- **Why:** this matches `StaticCode` today, and rest parameters come free.
  The cost is one allocation per call, until a fixed-arity path is added.

### 13. Errors: an `i32` status and an `any`

- **Pick:** status 0 carries a result and status 1 a thrown value. The
  program branches after each call.
- **Alternative:** WASM exception handling (WASM 3.0), later, as a second
  calling convention.

### 14. Identity: `same` is reference identity, and a runtime may merge equal values

- **Pick:** `same(a, b)` answers 1 when `a` and `b` are the same value. A
  content-addressable runtime may answer 1 for two structurally equal values.
  Conformance tests must not rely on two fresh objects being distinct.
- **Alternative:** require reference identity on every runtime.
- **Why:** values are immutable, so a merge shows only through `===` and
  `Object.is` on containers.

### 15. Naming and versioning

- **Pick:** the import module is `fjs:l0`, and a custom section, `fjs.abi`,
  names the version, `l0/1`. A runtime refuses a version it doesn't know.

## Where this draft is least sure

These four picks would change the most if we chose differently.

- **The shared memory and table (5).** It is the most mechanical choice, but
  it fixes how modules are loaded and laid out.
- **A builder or a bulk copy (8).** A bulk copy is faster, but the program
  then keeps a shadow stack.
- **Merged identity (14).** This is a choice about semantics, not only about
  the ABI.
- **Arguments as a sealed array (12).** It costs an allocation per call until
  a fixed-arity path exists.
