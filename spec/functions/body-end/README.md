# A Body That Does Not Terminate Is Refused

**Status:** refused by design

**`{}` is not FunctionalScript.** `() => {}` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

A JavaScript function whose block ends without `return` answers `undefined`, silently. FunctionalScript requires every block to end in `return`, `throw`, or a `switch` with a `default`, so what a function answers is always written ([functions](../README.md)).

The row `st.body-end` of [refused constructs](../../todo/refused-constructs.md)
registers the refusal, and [functions](../README.md) gives its reason.

## Examples

```js
/** @type {() => undefined} */
const f = () => {};
export default f();
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `undefined`.

## What to Write Instead

End the block with what the function answers, as [`alternative.f.js`](./alternative.f.js) does:

```js
/** @type {() => undefined} */
const f = () => {
    return undefined;
};
export default f();
```

It answers `undefined`. The answer is the same; now it is written.

## A Better Message

Today `fjs compile` prints `unexpected token` at the refused token. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- ECMA-262: [Function definitions](https://tc39.es/ecma262/#sec-function-definitions)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/return>
