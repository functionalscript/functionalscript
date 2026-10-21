# Function Outputs

**Status:** implemented

- A function is written by the graph outputs, the FunctionalScript, EDAG
  and Rust ones ([output](../../command-line/output.md)). JSON and DataJS have no function value,
  so they refuse a function in the selected result, even inside an array or
  object. A function used only during initialization or exported under an
  unselected name does not block data output:
  `const f = (a, b) => 1; export default [f.length];` writes `[2]` as JSON.

## Examples

The compiler demo has no programs for this page yet: its accepted and refused examples are a follow-up.

The demo on this page runs [`sample.f.js`](./sample.f.js), this page's
example as a function of one number — a function as a value: its `length`,
and a call of it — with every output `fjs compile` makes of it: the
expression graph (EDAG), the Rust and the WebAssembly that Rust builds to.
Its Run button calls the default export with `0` and `2`, as JavaScript and
as WebAssembly, and shows what each call returned or threw.

## Reference

- ECMA-262: [Function objects](https://tc39.es/ecma262/#sec-function-objects)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions>
