# A Guarded Conversion Is Refused

**Status:** refused by design

**`Number?.(x)` is not FunctionalScript.** `Number?.(x)` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

`?.(` calls a value unless it is `null` or `undefined`. A conversion is an operator, not a value, so it has no nullishness to guard, and `Number?.(x)` is refused at the word. The conversion is written `Number(x)`.

The row `op.guarded-conversion` of [refused constructs](../../todo/refused-constructs.md)
registers the refusal, and [operators and functions](../../principles/README.md#operators-and-functions) gives its reason.

## Examples

```js
export default Number?.("1");
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `1`.

## What to Write Instead

Write the conversion without the guard, as [`alternative.f.js`](./alternative.f.js) does:

```js
export default Number("1");
```

It answers `1`.

## A Better Message

Today `fjs compile` prints `reserved word` at the refused token. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- ECMA-262: [Optional chains](https://tc39.es/ecma262/#sec-optional-chains)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining>
