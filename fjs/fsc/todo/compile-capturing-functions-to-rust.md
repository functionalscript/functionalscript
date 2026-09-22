# Compile Capturing Functions to Rust

**Priority:** P2  
**Status:** proposal  
**Depends on:** `fjs/fsc/todo/compile-noncapturing-functions-to-rust.md`,
`nanvm-lib/todo/callable-function-objects.md`, and the landed
`IStaticFunction`/`Any::call` runtime support.

## Problem

The Rust compiler can currently emit callable functions, but only when the
function body is closed over no value from its enclosing scope. That excludes
ordinary closures such as:

```js
const increment = x => x + 1;
export default increment(41);
```

The generated function must preserve the value of `x` across the call boundary.
A Rust local is not sufficient: the closure may outlive the activation that
created it, and two closure instances created by the same source function must
retain independent captured values and identity.

The existing callable runtime already provides the right boundary:
`IStaticFunction::static_function` receives an owned frame and the call
receives an owned argument array. This proposal specifies how the compiler
builds and reads that frame.

## Goal

Compile a capture-free or capturing function to the same runtime shape:

```rust
A::static_function(code, length, captured_frame).to_any()
```

The generated code must:

- evaluate captured expressions exactly once, in enclosing-scope order;
- copy their values into an `Array<A>` when the function value is created;
- read captures only through the function's frame parameter;
- preserve `Result<Any<A>, Any<A>>` propagation through the function body;
- preserve function identity by constructing one runtime function object per
  source-level creation event;
- continue to support nested functions and calls through `Any::call`.

## Non-goals

This change does not add:

- mutual recursion between independently declared functions;
- dynamic module linking or cross-module generated function references;
- a bytecode interpreter implementation;
- named-parameter syntax or arity inference from argument reads;
- frame mutation or shared mutable closure state;
- optimizations such as frame-slot reuse or capture elimination beyond the
  existing analysis.

Self-recursion remains governed by the callable-object design. A function used
only as its own callee may use the generated static code path; a function value
that escapes or is captured must retain normal function-object identity.

## Source representation

The compiler consumes the existing EDAG function shape:

```js
['=>', null, body]
```

The `null` frame marker identifies the compiler-generated function form. Capture
analysis supplies the frame values; it does not change the public EDAG shape.
Inside a function body:

- `['args']` denotes the call's argument array;
- `['frame']` denotes the function's captured-value array;
- `['.', ['args'], index]` reads an argument;
- `['.', ['frame'], index]` reads a captured value.

The parser and EDAG linker remain responsible for producing valid frame reads.
The Rust backend must refuse malformed frame nodes rather than emitting a
plausible but incorrect Rust expression.

## Capture analysis

### Definition

A function captures a value when its body reads a declaration owned by an
outer lexical scope and that value is not a primitive constant available
without storage. A function does not capture:

- literals;
- built-in operators or intrinsic names;
- its own arguments;
- declarations introduced inside the function body;
- values already represented by an enclosing function's frame when the body
  reads that frame slot directly.

The analysis must be based on lexical ownership, not on textual name matching.
A shadowing declaration in the function body is a different binding and must not
be mistaken for a capture.

### Stable frame order

Assign frame slots in first lexical-use order after the EDAG has established the
function's enclosing declarations. The order must be deterministic and shared
by:

1. the frame expression emitted at the creation site;
2. every `['frame']` index emitted in the body;
3. exact generator proofs and fixture expectations.

If the existing linker already assigns a canonical declaration order, that order
is preferable to adding a second traversal rule. The chosen order must be
recorded in the analysis result rather than recomputed independently by the
printer.

### Nested functions

A nested function captures from the nearest scope that owns the declaration.
If a nested function needs a value captured by its parent, the parent may pass
that value through its own frame construction, but the nested function must
capture its own slot directly. It must not retain a live pointer to the parent's
activation.

Example:

```js
const make = x => y => x + y;
export default make(40)(2);
```

The outer closure captures nothing when created at module scope. Calling it
creates the inner closure with a frame containing the outer `x`; calling the
inner closure reads that frame slot and its own `args` slot.

## Generated Rust shape

For a function with captures, generate a frame at the creation site:

```rust
let c0: Any<A> = A::static_function(
    |_self, args| {
        let captured = /* frame read or enclosing value */;
        Ok(/* body using captured */)
    },
    1,
    [captured].to_array(),
).to_any();
```

The exact line wrapping is a readability concern of the Rust printer; the
semantic requirements are the argument order and the three `static_function`
arguments: code, declared length, and frame.

The generated closure receives the frame through the runtime's established
`_self`/function-object parameter. The printer must use the runtime-supported
frame accessor rather than inventing a second ABI. If the runtime exposes the
captured frame through `self_`, the generated body must use that name
consistently; if it exposes it through a dedicated `frame` parameter, the
printer must use that parameter consistently. The ABI choice belongs to the
runtime and must be documented beside `IStaticFunction`.

A frame expression is evaluated in the enclosing scope. Therefore its elements
must use the enclosing printer context, while the function body uses the
function context. This distinction prevents a frame element from accidentally
reading the new function's `args` or `frame`.

## Evaluation and errors

Frame elements are eager. The generated enclosing scope must establish them in
source order and propagate failures through the enclosing `Result`:

```rust
let captured: Any<A> = /* expression */?;
let frame: Array<A> = [captured].to_array();
```

A failure while evaluating a capture occurs when the closure value is created,
not when the closure is later called. This matches JavaScript lexical binding
and the existing EDAG eager evaluation model.

A failure in the function body occurs when the function is called and is
returned through `Any::call`. Every generated operation inside the body must
retain the current fallible printer behavior and use `?` at the function-body
boundary.

The compiler must refuse, with a structured `Result` error, when:

- a capture has no valid Rust spelling;
- a frame index is out of the analyzed frame range;
- a function body reads an enclosing declaration without a corresponding frame
  slot;
- a frame expression depends on a value reachable only through a lazy operand;
- a nested function would require a live enclosing activation;
- a function shape is malformed or has an unsupported frame marker.

No refusal may silently compile to `undefined`, an empty frame, or a fresh
replacement value.

## Identity and sharing

A shared EDAG node representing one function creation event is emitted as one
Rust binding and cloned at each use site. Two syntactically identical function
nodes created at different source locations must remain distinct runtime objects.

This gives the following expected behavior:

```js
const make = x => () => x;
const a = make(1);
const b = make(1);
// a === b is false; a === a is true.
```

The compiler must not reconstruct a captured function from code and frame at
every read of the same binding. That would change identity and violate the
runtime's function equality contract.

## Implementation plan

### 1. Analysis result

Extend the EDAG analysis result used by the Rust backend with a function-local
capture description:

- ordered captured declarations;
- frame slot for each declaration;
- function-local frame size;
- whether the function reads `args`, `frame`, or `self`;
- whether the function body can be emitted with the current Rust printer.

Keep this result immutable and make the printer consume it. Do not make the
printer independently rediscover lexical ownership.

### 2. Printer contexts

Separate the following contexts explicitly:

- enclosing module/function expression context;
- function creation context, where frame elements are evaluated;
- function body context, where `args`, `frame`, and `self` are bound;
- fallible expression context, where operations propagate with `?`.

The existing non-capturing path should be represented as an empty frame in the
same machinery, so captures do not create a second function ABI.

### 3. Runtime adapter

Confirm the public `IStaticFunction` contract supplies the generated body with
access to its captured frame. If the current runtime only stores the frame but
does not expose it to the static body, add the smallest runtime-facing accessor
and test it in `nanvm-lib` before changing the compiler.

The accessor must preserve VM abstraction: generated code may use `Array<A>` and
public VM traits, but must not depend on `naive` internals or `Rc` layout.

### 4. Generated fixtures

Add fixtures covering:

```js
const f = x => x + 1;
export default f(41);
```

```js
const make = x => y => x + y;
export default make(40)(2);
```

```js
const make = x => () => x;
const a = make(1);
const b = make(1);
export default [a(), b(), a === b];
```

Also cover a captured object/array, a missing argument, a throwing capture
expression, nested capture chains, and a function that both captures and reads
`args`.

Each generated fixture must be regenerated by `npm run gen`; generated `.rs`
files must not be hand-authored.

### 5. Proofs and refusal corpus

Add exact printer proofs for:

- one capture and its frame index;
- multiple captures and stable ordering;
- nested function frame construction;
- frame and argument reads in one body;
- capture-time versus call-time failure propagation;
- shared function identity;
- every refusal listed above.

The proof suite must retain 100% coverage for every new branch.

## Acceptance criteria

The implementation is complete when:

1. A capture-free fixture still produces byte-for-byte equivalent semantics.
2. A captured primitive survives closure creation and invocation.
3. A nested closure can capture an outer value without retaining an activation.
4. Captured arrays and objects preserve VM identity and value semantics.
5. Capture-time throws and call-time throws are distinguishable and correct.
6. Repeated use of one function binding shares identity; repeated creation does
   not.
7. Invalid capture/frame shapes are refused explicitly.
8. `tsc`, `npm run gen`, `npm test`, `node --test`, and the Rust checks pass.
9. The generated Rust remains readable: closure bodies, frame construction,
   nested scopes, and continuation calls have stable indentation.

## Open questions

- What exact public accessor exposes a static function's captured frame to its
  generated body?
- Does the runtime pass the function object as `_self`, or should
  `IStaticFunction` expose the frame as a separate closure parameter?
- Does the existing linker already provide lexical declaration ownership, or is
  a dedicated capture pass required?
- Which capture order is canonical when two declarations are first reached
  through different EDAG paths?
- Should direct self-calls use a special generated Rust path before function
  identity is observable, or always call through the runtime object?

These questions must be answered in code and tests before implementation is
merged. They should not be resolved by adding backend-specific assumptions to
individual fixtures.
