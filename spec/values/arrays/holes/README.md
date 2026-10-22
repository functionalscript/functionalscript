# An Array Hole Is Refused

**Status:** refused by design

**`[1, , 2]` is not FunctionalScript.** `[1, , 2]` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

In JavaScript `[1, , 2]` has a hole: an index with no element, which is not the same as an element holding `undefined`, since `1 in [1, , 2]` is `false` and `forEach` skips it. FunctionalScript arrays have no holes, so the empty slot is refused at its comma (`array hole`). The same comma in a pattern is an elision, and stays ([destructuring](../../../bindings/destructuring/README.md)).

The row `lit.array-hole` of [refused constructs](../../../todo/refused-constructs.md)
registers the refusal, and [arrays](../README.md) gives its reason.

## Examples

```js
export default [1, , 2].length;
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `3`.

## What to Write Instead

Write the element, `undefined` if that is what it holds, as [`alternative.f.js`](./alternative.f.js) does:

```js
export default [1, undefined, 2].length;
```

It answers `3`. Every index holds an element, so nothing skips it.

## A Better Message

Today `fjs compile` prints `array hole` at the refused token. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- ECMA-262: [Array initializer](https://tc39.es/ecma262/#sec-array-initializer)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#array_methods_and_empty_slots>
