# L0: a first detailed design

This draft turns the options in [l0-core.md](./l0-core.md) into one concrete
design, for discussion. It follows the decisions already recorded in the
[README](./README.md#decisions): a separate L1, no boxing chosen by L0, and
our own linker. Of its own choices, the builders of
[§22](#22-building-in-one-pass) and the throw that traps of
[§13](#13-errors-a-throw-traps), with what it changes in §12, §20 and §21,
are decided there too. The rest is not decided yet.
[modular-l0.md](./modular-l0.md) proposes splitting this one list into
runtime modules, cut by kind.

## Summary

L0 is 32 imported functions and 4 imported constants in one import module,
`fjs:l0`. A value is an opaque `i64`. Bytes cross through a memory both
modules share. Containers are built through a builder handle and then sealed,
values are reference counted, and a throw traps, so a call returns one value.

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
| Strings | `unit`, `from_unit` | `(s, i) -> i32`, `(i32) -> any` |
| | `concat`, `substring` | `(a, b) -> any`, `(s, start, end) -> any` |
| | `join` | `(parts, separator) -> any` |
| Containers | `begin_array`, `begin_object` | `(len) -> builder` |
| | `push`, `push_property` | `(builder, v)`, `(builder, key, v)` |
| | `seal` | `(builder) -> any` |
| | `length`, `item`, `key` | `(v) -> i32`, `(v, i) -> any`, `(o, i) -> any` |
| | `find` | `(o, key) -> i32`, the index or -1 |
| Lifetime | `dup`, `drop` | `(v) -> any`, `(v)` |
| Functions | `make_function` | `(code, frame, length, text) -> any` |
| | `call` | `(f, args) -> any` |
| | `throw` | `(v)`, then traps |
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
- **Later (2026-11-09):** a string may also be unpacked, into stack slots
  whose layout a runtime's String module chooses. The unpacked string is
  still no WASM type of the ABI: it lives in the program's locals and
  borrows its source `i64`
  ([modular-runtime.md](./modular-runtime.md)).

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
  `read_units` and `read_words` write into. The stock module of
  [L1](./l1-design.md) and [L2](./l2-design.md) is compiled the same way,
  so it gets a region of its own: the loader reserves one region for each
  compiled module. The runtime owns everything outside those regions, and
  never allocates into any of them.
- **Alternatives:** the runtime exports its memory and the program imports
  it; multi-memory (WASM 3.0); no shared memory, with a string passed one unit
  per call.
- **Why:** this works the same for a WASM runtime and a JavaScript runtime,
  and needs only WASM 2.0. The program states its sizes in a custom section,
  `fjs.layout`, so the loader can reserve them before instantiating the
  module. Its
  payload is three unsigned LEB128 numbers, in this order: the size of the
  data segments in bytes, the size of the scratch space in bytes, and the
  number of table entries.

### 6. Literals: built once at start-up

- **Pick:** the program's start function builds every literal string, bigint
  and constant container once and keeps it in a mutable global of its own.
  These values are never dropped.
- **Alternative:** build a literal each time it is used.
- **Why:** a literal in a loop costs one `global.get`, not an allocation.
  Building a literal cannot throw, so the WASM start function, which has no
  way to report a throw, is enough for it. Evaluating the module is not:
  see [choice 20](#20-a-program-is-one-module-with-an-init-export).

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
  last use. A value read from a global, an imported constant or a literal,
  is borrowed. Before it goes to a function that takes ownership, the
  program calls `dup`.
- **Alternatives:** an arena, where `drop` does nothing, is legal under the
  same ABI. WasmGC would need no `dup` or `drop`.
- **Why:** this matches NaNVM's `Rc` today, and the heap is acyclic. The cost
  is a new ownership pass in the compiler.

### 11. Misuse traps, and only calls fail

- **Pick:** L0 functions have preconditions. For example, `to_f64` on a
  string or `item` past the end reaches `unreachable`, and running out of
  memory traps. No L0 function returns a status.
- **Alternative:** a status from every L0 function.
- **Why:** L0 stays unchecked and fast. L1 checks types and throws the
  JavaScript errors, such as `TypeError`.

### 12. Functions: a code index, a frame, a length and a text

- **Pick:** all code has one type,
  `(param $self i64) (param $args i64) (result i64)`, and borrows `self`
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

### 13. Errors: a throw traps

- **Pick:** L0's `throw(v)` keeps the value and traps. The program emits
  `call $throw` and `unreachable` where it throws, and L1 throws its errors
  the same way. Code, `call` and `init` have one result, and nothing is
  tested after a call. Only the host catches a throw, through the `catch`
  and `sandbox` effects: it reads the value through the runtime's host-only
  exports and can go on with the same instance (choice 21). A runtime in
  JavaScript throws an instance of a private class instead.
- **Alternatives:** an `i32` status beside every result, which stable Rust
  cannot return without adapter modules; WASM exception handling (WASM
  3.0).
- **Why:** FunctionalScript has `throw` and no `try`, so a throw only has
  to reach the host, and every frame in between can be abandoned. A trap
  needs only WASM 2.0, and it is what a Rust panic compiles to. The
  abandoned frames run no `drop`, so the runtime frees what they held
  when the host recovers (choice 21). A `try` in the language would
  need WASM exceptions, as a new ABI version. See
  [l0-throw-trap.md](./l0-throw-trap.md).

### 14. Identity: `same` is reference identity, and a runtime may merge equal values

- **Pick:** `same(a, b)` takes two arrays, objects or functions, and
  answers 1 when they are the same value. Numbers, strings and the other
  primitives compare in L1 by content, so `same` never sees them. A
  content-addressable runtime may answer 1 for two structurally equal values.
  Conformance tests must not rely on two fresh objects being distinct.
- **Alternative:** require reference identity on every runtime.
- **Why:** values are immutable, so a merge shows only through `===` and
  `Object.is` on containers.

### 15. Naming and versioning

- **Pick:** the import module is `fjs:l0`, and a custom section, `fjs.abi`,
  names the version, `l0/1`. A runtime refuses a version it doesn't know.

### 16. Four string functions that need no memory

Added 2026-11-03 for [L1](./l1-design.md) and [L2](./l2-design.md), which
are written in FunctionalScript.

- **Pick:** `unit(s, i)` answers one UTF-16 unit, `from_unit(u)` makes a
  one-unit string, `concat(a, b)` joins two strings and
  `substring(s, start, end)` cuts one.
- **Alternative:** a string builder, `begin_string` and `push_unit`, which
  FunctionalScript source cannot name.
- **Why:** FunctionalScript code cannot address linear memory, so without
  these it can read and build no string. With them, `slice`, `charCodeAt`,
  `String.fromCharCode` and string `+` all get FunctionalScript bodies.
  Every runtime has these four natively anyway.
- **Relation to the String module:** `length` and `unit` on a string are
  what the memory-saving String module of
  [modular-runtime.md](./modular-runtime.md) does, decoding the `any` on
  each call. A String module with slots replaces them with `unpack`, then
  `length` and `at` over the unpacked value.

### 17. A FunctionalScript view of L0

- **Pick:** a module of intrinsics, `fjs/wasm/runtime/l0`, names the L0
  functions that FunctionalScript code may call: `kind`, `length`, `item`,
  `key`, `find`, `same`, `text`, the four string functions and `join`, plus
  the kind tags as constants, and the builders `buildArray` and
  `buildObject` (§22). It also has casts: `asNumber`, `asBoolean`, `asString`,
  `asBigInt`, `asArray`, `asObject` and `asFunction`. The compiler
  recognises each function by its body, as it does `fjs/js/intrinsic`
  today, and lowers it to the L0 import. A cast lowers to `to_f64`,
  `to_bool` or nothing, and gives the result a known type.
- **Not in the view:** allocation, `dup`, `drop` and memory. The compiler
  emits those from literals, from its ownership pass, and from spread over
  a value of known type. Spread of a known array or object lowers to
  builder calls over `length`, `item` and `key`, not to L1, so the closure
  rule allows it. A container of computed size is built in one pass by
  `buildArray` or `buildObject` (§22), not grown by spread, which would be
  quadratic.
- **Calls:** a call of a cast function, `asFunction(f)(...xs)`, lowers to
  L0 `call`, with the arguments built by the builder, or passed as they are
  when `xs` is a known array.
- **Why:** each intrinsic also has a plain JavaScript body, `kind` through
  `typeof`, so code written over the view runs and is proved on any
  JavaScript host today, before a WASM backend exists.
- **The JavaScript bodies check preconditions.** A cast throws unless the
  value has its kind, and a function that takes an `i32` in WASM throws
  unless its argument is an integer in range. In WASM the same mistake
  traps, so a proof on a JavaScript host finds every misuse that would trap.
- **Who reads the view:** only the WASM backend recognises the intrinsics,
  and only `fjs/wasm/runtime/l1` imports the view. The interpreter and the Rust
  backend never see it, so each intrinsic costs one recognised body in one
  backend, not one in every executor, as `fjs/js/intrinsic` costs today.
- **Numbers:** FunctionalScript numbers are `f64`. Where L0 takes an
  `i32`, the compiler truncates, and a value that is not an integer in
  range traps.

### 18. What `length`, `item` and `key` mean for each kind

| Kind | `length(v)` | `item(v, i)` | `key(v, i)` |
| --- | --- | --- | --- |
| String | UTF-16 units | traps; use `unit` | traps |
| Bigint | `u64` words | traps; use `read_words` | traps |
| Array | items | the item | traps |
| Object | properties | the value of property `i` | the key of property `i` |
| Function | declared parameters | traps | traps |

`a.length` in a program is L1's member read, not L0's `length`. For an
object, L1 reads its `length` property through `find`.

### 19. Bigints are canonical

- **Pick:** `make_bigint` takes a magnitude with no leading zero words and
  a sign of 0 for zero, 1 for positive and -1 for negative. Zero is 0 words
  with sign 0. Any other input traps.
- **Why:** one value has one form, so `length(b) === 0` tests for zero, and
  equal bigints have equal words.

### 20. A program is one module, with an `init` export

- **Pick:** the compiler links all the FunctionalScript modules of one
  program into one WASM module. It exports `init`, of type `() -> any`,
  which evaluates the modules in import order and answers the main module's
  default export. A throw at a module's top level traps, as anywhere else.
- **Alternative:** one WASM module per FunctionalScript module, linked by the
  loader.
- **Why:** a module's top level can throw, and the host cannot catch a
  trap in the WASM start function, which runs while the module is
  instantiated. One module per program also keeps calls between modules
  direct. Modules can be split later, because each one is already a function
  of its imports.

### 21. The host is an L0 client

- **Pick:** the host reads a program's result, and the requests of its
  effects, through L0's reads, `kind`, `length`, `item`, `key`, `to_f64`
  and `read_units`. It answers through L0's builders and continues through
  `call`. Serialising a value as JSON for the harness is host code over the
  same reads.
- **After a trap:** a runtime also exports five host-only functions, not
  L0 imports. The host calls `enter()` before each call into the program
  and `leave()` after it returns. `has_thrown() -> i32` answers 1 when a `throw` caused the
  trap, and `thrown() -> any` answers its value. Otherwise the trap was a
  misuse and the host stops. Before it goes on, the host calls `recover()`.
  It frees every value and builder made since the innermost `enter()` and
  before the `throw`, which the abandoned frames held, then clears the
  flag and ends that call. A runtime that keeps a
  stack in linear memory also exports `__stack_pointer`. The host saves it
  before each call into the program and writes it back after a caught trap.
- **Why:** NaNVM's effect loop already works this way over `Any`
  ([`effects-node`](../../../nanvm/effects-node/src/native.rs)), so no new
  import is needed.

### 22. Building in one pass

Added 2026-11-03, after the first L1 bodies grew arrays, objects and
strings one item at a time, which is quadratic.

- **Pick:** the view has two builders. `buildArray(n, s, next, at)` builds
  `n` items, and `buildObject(n, s, next, keyAt, valueAt)` builds `n`
  properties. Each walks `n` states: state 0 is `s`, and each next state is
  `next` of the one before, called only between two items. Item `i` is `at`
  of state `i`, and property `i` is `keyAt` and `valueAt` of it. A key must
  be a string. A call whose functions are arrow literals lowers to
  `begin_array(n)` or `begin_object(n)`, one loop that keeps the state in a
  local and `push`es each item, and `seal`. No closure is allocated, and
  the ABI does not change.
- **Pick:** L0 gets one new function, `join(parts, separator)`: the strings
  of an array joined with the separator between two of them. With it, a
  string of computed parts is a `buildArray` and one `join`.
- **Alternative:** a state of `[item, next]` pairs, one function instead of
  two. Each step would then allocate a pair, unless the compiler removed it.
- **Alternative:** divide-and-conquer bodies over `concat` and spread. They
  cost O(n log n) and need no change, but every body that builds would
  have to be written that way.
- **Alternative:** a string builder, `begin_string` and `push_unit`. Like
  §16, it would be a pair of imports FunctionalScript cannot name, where
  `join` is one that it can.
- **Why:** the state lets a body build what it cannot index directly, such
  as the code points of a string, which `toIterable` finds by walking unit
  offsets. Every runtime has `join` natively already.

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
