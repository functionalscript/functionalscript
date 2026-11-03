# L2: a first detailed design

This draft makes the notes in [l2-stock-runtime.md](./l2-stock-runtime.md)
concrete. It builds on the [L0](./l0-design.md) and [L1](./l1-design.md)
designs, and keeps the aim of writing the runtime in FunctionalScript first.
Nothing here is decided yet.

## Summary

L2 is [`fjs/js/runtime`](../../../fjs/js/runtime/module.f.js), unchanged in
meaning, compiled by our WASM backend into the same stock module as L1.
Today's natives, the primitives that
[the runtime README](../../../fjs/js/runtime/README.md#the-names-without-a-body)
lists, get FunctionalScript bodies over the L0 view. After that, the
whole stock runtime is FunctionalScript, and a host runtime supplies only
L0 and L1's native rows.

## Design choices

### 1. The source stays where it is

- **Pick:** `fjs/js/runtime` keeps its tables, `statics` and `member`, and
  its `runtime` export, `static`, `dot` and `in`. Its proofs keep running
  on a JavaScript host, and the Rust backend keeps compiling it, so NaNVM
  as it is today keeps working.
- **Why:** one source of truth
  ([DESIGN.md §13](../../DESIGN.md#13-one-source-of-truth-optimize-by-substitution)).
  The WASM backend is one more consumer of the same source.

### 2. Today's natives get FunctionalScript bodies

Each primitive in the table below becomes FunctionalScript over the
[L0 view](./l0-design.md#17-a-functionalscript-view-of-l0). The L0 string
functions were added for this.

| Today | Body over the L0 view |
| --- | --- |
| `charCodeAt(s, i)` | `unit` after the position check, `NaN` outside the string |
| `slice(s, start, end)` | the clamped positions, then `substring` |
| `String.fromCharCode(...units)` | a loop of `from_unit` and `concat` |
| `Object.entries(o)` | a loop of `key` and `item` that builds pairs |
| `entry(o, k)`, `hasEntry(o, k)` | `find`, then `item` |

- **Why:** each was native only because no body could read a unit or a key.
  The L0 view can, so the list of natives shrinks to L1's native rows.
- **Cost:** `String.fromCharCode` and `Object.entries` are quadratic as
  written. That is the price of a reference body, and it is the first place
  for a native substitution.

### 3. Statics link by name

- **Pick:** a program imports a static by its id, such as
  `(import "fjs:static" "Object.is" ...)`, and the stock module exports one
  function per entry of `statics`. `runtime.static`, the lookup by string,
  is no longer needed in compiled code.
- **Why:** the id is known when the program is compiled, so a lookup at
  run time is wasted work. A runtime overrides a static the way it
  overrides an L1 operation: by exporting the same name.

### 4. Member calls go through `runtime.dot`

- **Pick:** L1's `callMember(self, key, args)` calls the FunctionalScript
  `runtime.dot(self, key)` and then calls what it answers. It throws when
  the answer is `undefined`, unless the call is optional.
- **Why:** dispatch depends on the receiver, so it is dynamic, and `dot`
  already writes the order once: own property, then member body, then
  `undefined`.
- **Later:** where the compiler knows the receiver's kind and the key is a
  literal, it can call the member body directly, such as `startsWith` on a
  known string. That is an optimization of the program and needs no new
  ABI.

### 5. One stock module for L1 and L2

- **Pick:** L1's bodies and L2 compile together into one module. It imports
  `fjs:l0` and `fjs:l1-native` and exports `fjs:l1`, `fjs:static` and
  `fjs:runtime`, which holds `dot` and `in`.
- **Alternatives:** separate modules for L1 and L2, or one module per
  table.
- **Why:** L2 calls L1 constantly, and calls within a module are direct
  and can be inlined by our own linker later. A split is easy to make
  later, because every name is already an export.

### 6. Substitution order

- **Pick:** when the loader links a program, it takes each import of
  `fjs:l1`, `fjs:static` and `fjs:runtime` from the host runtime if the
  host exports it, and from the stock module otherwise.
- **Why:** this is the one rule that lets NaNVM, or any runtime, replace a
  FunctionalScript body with native code, without changing the body or the
  program. A conformance run compares every substituted name with its body.

## The first implementation

1. The L0 view, `fjs/js/l0`, with JavaScript bodies, and its proofs.
2. The L1 bodies in `fjs/js/l1`, proved against JavaScript's operators.
3. The bodies of today's natives in `fjs/js/runtime`, proved against the
   host's built-ins, as the static bodies are proved today.
4. A WASM backend that compiles the stock module, and a small program
   linked with it, on a host that provides L0 and L1's native rows: NaNVM
   in Rust, or a runtime in JavaScript.

Steps 1 to 3 need no WASM at all. They run, and are proved, on any
JavaScript host, and they give the WASM backend a finished runtime to
compile.

## Where this draft is least sure

- **Quadratic bodies (2).** If they are too slow even for the first
  tests, `String.fromCharCode` and `Object.entries` stay native a little
  longer.
- **Static imports by id (3).** An id such as `Object.is` contains a dot.
  WASM names may hold any UTF-8, but tools may not expect this.
