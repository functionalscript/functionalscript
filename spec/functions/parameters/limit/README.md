# More Than 16 Fixed Parameters Are Refused

**Status:** refused by design

**`17 parameters` is not FunctionalScript.** `(a, b, …, q) => q` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

A function has at most 16 fixed parameters, a language limit approved so that every valid function can be written, with the right `length`, by every backend. A 17th fixed name is refused; a rest parameter takes any number of arguments ([parameters](../README.md)).

The row `decl.parameter-limit` of [refused constructs](../../../todo/refused-constructs.md)
registers the refusal, and [parameters](../../../todo/3120-parameters.md) gives its reason.

## Examples

```js
/** @type {(...p: number[]) => number} */
const f = (a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q) => q;
export default f(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17);
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `17`.

## What to Write Instead

Take many arguments with a rest parameter, or pass one object, as [`alternative.f.js`](./alternative.f.js) does:

```js
/** @type {(...p: readonly number[]) => number | undefined} */
const f = (...p) => p[16];
export default f(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17);
```

It answers `17`.

## A Better Message

Today `fjs compile` prints `more than 16 fixed parameters` at the refused token. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- ECMA-262: [Function definitions](https://tc39.es/ecma262/#sec-function-definitions)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/rest_parameters>
