# `==` Is Refused

**Status:** refused by design

**`==` is not FunctionalScript.** `a == b` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

JavaScript's `==` and `!=` convert their operands before comparing them, by rules that depend on both types: `0 == ""` and `0 == "0"` are `true` while `"" == "0"` is `false`, and `null == undefined` is `true` while `null == 0` is `false`. A reader cannot tell what a comparison does without knowing both types, so the operators are refused rather than given a meaning of their own. `===` and `!==` compare without converting, and a conversion that is meant is written, `Number(x)` or `String(x)`.

The row `op.loose-equality` of [refused constructs](../../todo/refused-constructs.md)
registers the refusal, and [operators](../README.md) gives its reason.

## Examples

```js
/** @type {(a: unknown, b: unknown) => boolean} */
const same = (a, b) => a == b;
export default same(0, "");
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `true`.

## What to Write Instead

Compare with `===`, and write the conversion you mean, `Number(b)` or `String(a)`, as [`alternative.f.js`](./alternative.f.js) does:

```js
/** @type {(a: number, b: string) => boolean} */
const same = (a, b) => a === Number(b);
export default same(0, "");
```

It answers `true`. `""` converts to `0`, the conversion `==` made, now written where a reader sees it.

## A Better Message

Today `fjs compile` prints `unexpected token` at the refused token. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- ECMA-262: [Equality operators](https://tc39.es/ecma262/#sec-equality-operators)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Equality>
