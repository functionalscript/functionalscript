# `this` Is Refused

**Status:** refused by design

**`this` is not FunctionalScript.** `this` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

JavaScript's `this` is an input a function receives from how it is called rather than from its arguments: `o.f()` passes `o`, `(0, o.f)()` passes `undefined`, and an arrow takes the `this` of the code around it, which at a module's top level is `undefined`. FunctionalScript keeps a function's inputs to its parameters, so the value a function reads is the value it was given, and `this` is refused by design.

The row `op.this` of [refused constructs](../../todo/refused-constructs.md)
registers the refusal, and [design principles](../../design/design-principles.md) gives its reason.

## Examples

```js
export default typeof this;
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `undefined`.

## What to Write Instead

Pass the value as a parameter, as [`alternative.f.js`](./alternative.f.js) does:

```js
/** @type {(o: { readonly n: number }) => number} */
const get = o => o.n;
export default get({ n: 1 });
```

It answers `1`. The object is an argument, so what the function reads does not depend on how it is called.

## A Better Message

Today `fjs compile` prints `reserved word` at the refused token. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- ECMA-262: [The this keyword](https://tc39.es/ecma262/#sec-this-keyword)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this>
