# Compile Capturing Functions to Rust

**Priority:** P2  
**Status:** landed in #2197; this document records the shipped shape and the
remaining gaps.  
**Related:** [functions](../../../spec/README.md#functions),
[function-frame](../../../spec/todo/3111-function-frame.md),
[callable-function-objects](../../../nanvm-lib/todo/callable-function-objects.md),
the Rust printer `fjs/edag/rust/module.f.mjs`, and the fixture
`nanvm-harness/fixtures/closure.mjs`.

**Format boundary:** "What shipped" records the current zero-arity
`['=>', frame, body]` / `['args']` format. It is not the target argument
model for named parameters. The pending
[named-and-rest plan](../../../spec/todo/3120-parameters.md) owns the
coordinated `length` / `['arg', N]` / `['rest']` migration described under
Remaining gaps. This documentation update changes no executable behavior.

## What shipped

A function body that reads a name bound outside it — a module `const`, an
import, an enclosing function's parameter or an enclosing body's `const` — is a
capture, as a JavaScript closure's is ([functions](../../../spec/README.md#functions)).

```js
const base = [10];
const add = (...a) => (...b) => a[0] + b[0];
const offset = (...a) => base[0] + a[0];
export default [add(1)(2), offset(5)];
```

### EDAG

A function is `['=>', frame, body]`. The second operand *is* the frame:

- `null` means the function captures nothing;
- a capturing function has `['[]', [c0, c1, …]]`, one slot per captured value,
  each value once however many bindings or references reach it, in the order
  the body first names them;
- inside the body, `['args']` is the call's argument array and `['frame']` the
  captured array, so `['.', ['frame'], i]` reads slot `i`;
- a nested function captures through its parent: its frame elements are
  expressions of the parent's body, including the parent's `['frame']` slots
  and `['args']`, never a pointer to the parent's activation.

`['self']` is not an EDAG node (`fjs/edag/analysis/module.f.mjs` admits only
`undefined`, `args` and `frame` as leaves), so a body has no way to name its
own function; see [Remaining gaps](#remaining-gaps).

A captured primitive is written into the body instead of a slot, as a `const`
holding one is wherever it is read.

### Rust

The printer emits one runtime shape for every function, capturing or not:

```rust
let c5: Any<A> = [f64_any(0x4024000000000000)].to_array().to_any();
let c6: Any<A> = A::static_function(|self_, args| {
    let c0: Any<A> = Any::dot(A::frame(self_).clone().to_any(), f64_any(0x0000000000000000)).end()?;
    let c1: Any<A> = Any::dot(c0, f64_any(0x0000000000000000)).end()?;
    let c2: Any<A> = Any::dot(args.clone().to_any(), f64_any(0x0000000000000000)).end()?;
    c1 + c2
}, 0, [c5].to_array()).to_any();
```

(`offset` from the example above, as `nanvm-harness/fixtures/closure.rs`
prints it.)

- The frame's elements are bound in the enclosing scope, before
  `static_function` is called, by the enclosing printer context; the body
  cannot see them except through its frame.
- The body reads its frame as `A::frame(self_)`: `StaticCode` receives
  `&A::InternalFunction` and `IStaticFunction::frame(self_)` returns the
  captured `Array<A>` (`nanvm-lib/src/vm/internal/istatic_function.rs`). A
  body that reads no frame names its parameter `_self`.
- A function with no captures passes `Array::default()`.
- The `length` is `0`: `f.length` is `0` for a rest parameter as for none
  ([functions](../../../spec/README.md#functions)).

### Evaluation, errors and identity

- Frame elements are eager. A failure computing one occurs when the closure is
  created and propagates through the enclosing `Result`; a failure in the body
  occurs when the closure is called and returns through `Any::call`.
- One EDAG function node is one `let` binding, cloned at each use, so reading
  one binding twice gives the same object. Each evaluation of a function node
  — each call of the function that contains it — builds a new object:

  ```js
  const make = (...a) => () => a[0];
  const f = make(1);
  const g = make(1);
  export default [f(), g(), f === g, f === f]; // [1, 1, false, true]
  ```

### Refusals

The Rust printer refuses, with a structured error, rather than printing a
plausible wrong value:

- a frame that is not an array literal;
- a frame node reached from anywhere but its own function;
- a shared node reached only through lazy operands;
- a module scope that reads `['args']` or `['frame']` (`fjs/fsc/rust`).

The parser refuses `capture shadowed`: a body `const` that shadows a name the
body has already read from outside.

## Remaining gaps

1. **Named parameters and arity.** The current zero-arity implementation
   above does not recognize `x => ...` or `(a, b, ...rest) => ...`. The earlier
   [count-only proposal](https://github.com/functionalscript/functionalscript/pull/2200)
   is not the target contract. Follow
   [named and rest parameters](../../../spec/todo/3120-parameters.md), pending
   language-design approval: `['=>', length, frame, body]`, constant
   `['arg', N]` with `0 <= N < length`, and one per-invocation `['rest']`.
   Both metadata fields require canonical positive zero, not `-0`.
   Missing fixed arguments yield `undefined`; rest contains only the actual
   tail from `length`, preserving its identity through captures. Pass the
   declared length to `static_function` and migrate binding lowering too;
   merely changing its count while retaining EDAG-visible complete `['args']`
   is insufficient. A Rust array named `args` may remain private call transport.
   Migrate old zero-arity reads by owning scope, never silently reinterpret
   positive-arity/full-arguments sketches. Add AOT/evaluator/source tests for
   omitted, explicit `undefined` and extra arguments, unused fixed positions,
   captured fixed/rest values and rest identity. Native capacity is independent
   of the JavaScript factory table. Preserve supported callable exports and
   the parameter plan's required default-rendering contract.
2. **Recursion.** A function that names itself is refused (`const not found`):
   its `const` is not bound in its own initializer, and there is no `self` to
   read in its place. Whether a direct self-call gets a special Rust path or
   always calls through the runtime object is open, and belongs with
   [callable-function-objects](../../../nanvm-lib/todo/callable-function-objects.md)
   and [forward-references](../../../spec/todo/3140-forward-references.md).
3. **Capture shadowing.** `capture shadowed` is a gap, not a rule; see
   [`body-const-forward-reference.md`](../parser/todo/body-const-forward-reference.md).
4. **Fixture coverage.** `closure.mjs` pins captures of an enclosing
   argument, a module `const` and a three-deep nested chain. These behaviors
   compile today but no generated fixture pins them:
   - identity: two closures made by the same function are distinct, one
     binding read twice is the same (the example above);
   - a captured object or array keeps its identity (`get() === o.x`);
   - a failure computing a frame element fails at creation, not at the call:

     ```js
     const make = (...a) => { const v = a[0].x; return () => v; };
     export default make(undefined);
     ```

   Each fixture is generated by `npm run gen`, never written by hand.
