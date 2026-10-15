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
([destructuring](../bindings/destructuring.md)); a default is not supported yet. A
newline before `=>` is refused.

## Pages

- [Parameters](./parameters.md)
- [Captures and Self Recursion](./captures.md)
- [Names and Identity](./names-and-identity.md)
- [Calls](./calls.md)
- [Function Outputs](./function-outputs.md)

## Examples

The compiler demo offers the programs `index` in [`module.f.js`](./module.f.js), each with its real output.

## Reference

- ECMA-262: [Function definitions](https://tc39.es/ecma262/#sec-function-definitions), [Arrow function definitions](https://tc39.es/ecma262/#sec-arrow-function-definitions)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions>
