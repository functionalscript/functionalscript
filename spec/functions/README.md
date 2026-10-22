# Functions

**Status:** implemented

```js
export default (...args) => [args, args[0]];
```

The same function, written with a block body:

```js
export default (...args) => { return [args, args[0]]; };
```

A function that takes no arguments, its parameter list empty:

```js
export default () => 6;
```

A function is an arrow with zero or more fixed named parameters and an
optional final rest parameter. Its body is an expression or a block:

```js
export default (a, b, c, ...x) => [a, b, c, x];
```

Bare `a => a`, `(a) => a`, and a fixed list with a trailing comma are also
accepted. No parameter or comma may follow rest. A fixed parameter takes a
pattern, `({ a }, [b]) => [a, b]`, as a `const` does
([destructuring](../bindings/destructuring/README.md)), and a default, `(a, b = a) => [a, b]`
(below); the rest parameter takes neither. A newline before `=>` is
refused.

## Pages

- [Parameters](./parameters/README.md)
- [Captures and Self Recursion](./captures/README.md)
- [Names and Identity](./names-and-identity/README.md)
- [Calls](./calls/README.md)
- [Call Statements](./call-statements/README.md)
- [Function Outputs](./function-outputs/README.md)

## Examples

The compiler demo offers the programs `index` in [`module.f.js`](./module.f.js), each with its real output.

The demo on this page runs [`sample.f.js`](./sample.f.js), this page's
example as a function of one number — a function with a rest parameter: the
argument count, and the first argument times ten — with every output `fjs
compile` makes of it: the expression graph (EDAG), the Rust and the
WebAssembly that Rust builds to. Its Run button calls the default export
with `1` and `2`, as JavaScript and as WebAssembly, and shows what each call
returned or threw.

## Reference

- ECMA-262: [Function definitions](https://tc39.es/ecma262/#sec-function-definitions), [Arrow function definitions](https://tc39.es/ecma262/#sec-arrow-function-definitions)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions>
