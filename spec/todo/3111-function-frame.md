# Function frames: NaNVM function objects

A user function object is serialized as an EDAG — the stable, canonical representation of functions
(see [serialization](./serialization.md)). On loading, a VM
implementation may transform the EDAG into internal, VM-specific bytecode, executed by a bytecode
interpreter upon a call. This document describes such an internal bytecode scheme; nothing here is
part of the stable serializable format. The VM's bytecode generator produces that bytecode plus
metadata that it needs to generate correct call site bytecode.

**Argument-model boundary:** slots and argument arrays in the sketches below
are VM-internal storage, not a requirement to expose a complete-arguments EDAG
node. The former zero-arity format used `['args']`; the implemented
[named-and-rest plan](./3120-parameters.md) replaces it with
`['=>', length, frame, body]`, constant `['arg', N]` and one per-invocation
`['rest']` array. Validate canonical integer metadata (positive zero, never
`-0`) and `0 <= N < length`; missing fixed values are `undefined`, and rest
is the actual tail beginning at `length`. Preserve rest identity within a
call and through captures, with fresh rest bindings across JS-compatible
calls. Slot lowering must implement those observations, not restore the
retired positive-arity/full-`args` proposal. Bytecode implementation remains
separate from the compiler, JavaScript executor and Rust source migration.

That metadata specifies the size of function's frame - a span of NaNVM's 64-bit values that keeps:

- values of actual parameters (in a contiguous range of slots - to allow to refer to these values
via indexed "arguments" elements);

- a result value slot;

- slots for local consts (plus local mutable vars);

- slots for temp values needed for calculating expressions (implicit consts).

In addition to that, when instantiated, a function object owns a frame of captured consts. To
simplify the interpreter we consider it as a separate frame, even though in many cases it could
be slightly efficient to place slots of captured consts into the function's frame described above.

## Captured consts

Considering that function calls up the callstack have their frames with slots devoted to consts that
a callee captures, why cannot function's bytecode refer to those slots directly - instead of
requiring the caller to copy over all captured values to devoted slots owned by the callee
function's (the aforementioned frame of captured consts)? To implement that, bytecode can represent
a reference as a two-part value: a) a frame index (e.g. 0 for function's own frame, 1 for the caller
function's frame, 2 for the frame of the function that called the caller function - and so on) and
b) a slot index within that frame.

Keeping in mind that idea, we should start with a simpler scheme with all captured values copied
to a devoted memory block created at the moment of the function object creation - due to the
following reason. Besides being called right after being created - and then getting disposed
immediately after that call - a function object "A" can be passed around. For example, in a
"trampoline" code pattern the outer function "B" can return A as B's call result to its caller
function "C". If A's code refers to captured values of B's frame in the frame index + slot index
scheme described above, at the moment when B returns A (a function object value) to C, B's frame
cannot be disposed - since when A gets called, it will refer to slots in B's frame. That makes
ownership control more complicated than necessary is a simple interpreter, plus unnecessarily
increases memory footprint (since B's frame has slots other than slots of values captured by A).

## Metadata sketch

What does the compiler need to know about a compiled "callee" function to produce call site
bytecode? Here goes a preliminary sketch:

- A "proper" callee's frame size. In a simple scheme, there will be a command to allocate a "stack
frame" of the given size, followed up by commands filling certain slots of that callee frame
(copying over actual parameters to their designated slots).

- Info on a memory block that keeps captured values. Its lifetime coincides with the lifetime of
the function object (since these values are needed at each call). That block gets designated at the
moment of the function object instantiation. Essentially it's a "captured values frame" that has
a different lifespan compared with the aforementioned "proper" call frame. The compiler produces
instructions on feeling out that memory block at the moment of function object's instantiation.
In absence of captured values, that set of instructions is empty (since there is no need for that
frame of captured values).

- Info needed to generate call site's instructions on copying over parameters to the callee's frame.

- Function result slot index (within the callee frame) - to copy over the result from the callee
frame to a slot in the caller frame. The callee's frame can be disposed after that copying. In a
simple scheme the compiler uses slot 0 always for that purpose. In case a function does not return
any result value, a simple scheme places "undefined" value in that slot to comply with ECMAScript.

## Optimizations to consider

1) Let's assume that the FS compiler does a good job on tail recursion optimization so "truly
recursive" functions are rare in compiled bytecode. In that case the compiler marks a compiled
function as not "truly recursive" and calculates an expanded frame size of it - allowing for
expanded frame sizes of all functions called from the given one. Such a not "truly recursive"
function can share same expanded frame memory block with all functions it calls, and in turn, its
frame can be a contiguous slot range within the callee's expanded frame. That simple technique
allows to reduce amount of frame memory block allocations / disposals. It makes sense to benchmark
this optimization that looks like a low hanging fruit.

## Recursive Functions

Where the frames above come from, at the source level. Two mutually
recursive functions:

```js
const a = i => b(i + 3)
const b = i => i % 5 === 0 ? i : a(i)
```

```rust
fn a(frame: Array<Any>, param: Array<Any>) {
  let i = param[0];
  let b = frame[1];
  b(frame, &[i + 3])
}
fn b(frame: Array<Any>, param: Array<Any>) {
  let i = param[0];
  if (i % 5 === 0) {
      i
  } else {
      let a = frame[0];
      a(frame, &[i])
  }
}
```

The named parameter and the conditional are in the language; `a` reaching
`b`, declared after it, is not yet
([forward-references](./3140-forward-references.md)). These are illustrative
mutual-recursion/slot sketches, not implemented source or permission to
expose a complete `args` binding. Ordinary captures are implemented: the
compiler's frame is described under [EDAG](../../fjs/fsc/README.md#edag), and
[`fjs/edag/rust`](../../fjs/edag/rust/module.f.mjs) prints it as the frame
array a Rust closure is built with.

This document's frame is the bytecode-interpreter design. The parallel AOT
plan reuses the captured-value copy scheme and the applicable EDAG contract,
not a permanent `['args']` model: historical zero-arity behavior is distinguished
from the implemented `length` / `arg` / `rest` format. Rust's own call frame
supplies local storage, so AOT does not need this explicit slot layout.
A private Rust argument array may remain transport but must not expose the
original fixed-prefix count to the new EDAG body. Neither slot layouts nor
AOT inherit a JavaScript factory-table arity cap. See
[callable-function-objects](../../nanvm-lib/todo/callable-function-objects.md)
for the matching binding, identity and regression-test obligations. Existing
frame/self semantics and separate recursion work are not expanded here.
