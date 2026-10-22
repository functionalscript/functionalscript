# A Conversion With Other Than One Operand Is Refused

**Status:** refused by design

**`Number(1, 2)` is not FunctionalScript.** `Number(x, y)` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

`Number(x)` and `String(x)` are conversions, operators with one operand, not calls of a function value. JavaScript ignores a second argument and converts `undefined` when there is none, and a spread hides how many there are; FunctionalScript refuses each shape but the one operand, so a conversion always says what it converts.

The row `op.conversion-call-shape` of [refused constructs](../../todo/refused-constructs.md)
registers the refusal, and [operators and functions](../../principles/README.md#operators-and-functions) gives its reason.

## Examples

```js
// @ts-expect-error: TypeScript refuses the second operand too
export default Number("1", 2);
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `1`.

The extra argument in `sample.mjs` is intentional. A code-quality check
correctly reports a superfluous argument to `Number`; removing it would turn
the negative example into an accepted conversion and stop testing this refusal.

## What to Write Instead

Convert one value, as [`alternative.f.js`](./alternative.f.js) does:

```js
export default Number("1");
```

It answers `1`.

## A Better Message

Today `fjs compile` prints `Number takes one argument` at the refused token. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- ECMA-262: [The Number constructor](https://tc39.es/ecma262/#sec-number-constructor-number-value)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/Number>
