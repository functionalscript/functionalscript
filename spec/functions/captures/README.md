# Captures and Self Recursion

**Status:** implemented

- A name the body reads from a scope around it — a `const`, an import, an
  enclosing function's parameter or an enclosing body's `const` — is a
  **capture**, as a JavaScript closure's is. The function's frame is the
  array of the captured values, each value once however many bindings or
  references reach it, in the order the body first names them, built where the
  function is written; the body reads a capture as a slot of it, and a
  nested function captures through its parent. Nothing mutates, so a frame
  copied when the function is made is unobservable from a closure over the
  scope ([function-frame](../../design/3111-function-frame.md)). A captured
  primitive is written into the body instead, as a `const` holding one is
  wherever it is read, since it has nothing to share.

  Captures are JavaScript's closures, not a feature of this language's
  own: a capture was an error only while a function had no frame to
  capture with, a restriction whose reason is gone
  ([DESIGN.md §12](../../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)).
  The frame is the one [function-frame](../../design/3111-function-frame.md) and
  the EDAG's closed-scope model
  ([`["frame", N]`](../../../todo/edag-stage1-discussion.md)) describe.

  ```js
  const base = [10];
  const add = (...a) => (...b) => a[0] + b[0];
  export default [add(1)(2), ((...a) => base[0] + a[0])(5)];
  ```

  A function that names itself reaches itself: in
  `const fact = n => n < 2 ? 1 : n * fact(n - 1);` the inner `fact` is the
  function itself, the EDAG's `["self"]`, and `export default fact(5);`
  exports `120`. The name is the function's own only where the function is
  the whole value of the `const`, a module's or a body's: `const f = [() => f];`
  and `const f = (() => f)();` are `const not found`, since neither value is
  a function with a self to read. The function's own name comes after the
  names its body binds, as in JavaScript: a parameter or a body `const` of
  the same word shadows it — unless the body has already read the function
  by that word, which is refused as a capture shadowed is
  ([functions](../README.md)). A function nested in it captures the name as
  it captures any other value around it, so `const f = x => () => f(x);`
  recurs through the inner function. Reading a *later* `const`, and so two
  functions calling each other, is still refused
  ([forward-references](../../todo/3140-forward-references.md)).

## Examples

The compiler demo offers the programs `captures` in [`module.f.js`](../module.f.js), each with its real output.

The demo on this page runs [`sample.f.js`](./sample.f.js), this page's
example as a function of one number — a closure: the inner function captures
the outer parameter and a module `const` — with every output `fjs compile`
makes of it: the expression graph (EDAG), the Rust and the WebAssembly that
Rust builds to. Its Run button calls the default export with `1` and `10`,
as JavaScript and as WebAssembly, and shows what each call returned or
threw.

## Reference

- ECMA-262: [Function objects](https://tc39.es/ecma262/#sec-function-objects)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures>
