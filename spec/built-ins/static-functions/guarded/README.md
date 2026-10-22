# A Guarded Namespace Is Refused

**Status:** refused by design

**`Object?.is` is not FunctionalScript.** `Object?.is` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

`Object` is a namespace, not a value: the language reads `Object.is` and `Object.entries` as the static functions they name. A guard asks whether a value is `null` or `undefined`, and a namespace is never either, so `Object?.is` and `Object?.["is"]` are refused at the word. Guarding the function is a call of a value, and stays: `Object.is?.(a, b)` ([static functions](../README.md)).

The row `acc.guarded-namespace` of [refused constructs](../../../todo/refused-constructs.md)
registers the refusal, and [built-in static functions](../README.md) gives its reason.

## Examples

```js
export default Object?.is(1, 1);
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `true`.

## What to Write Instead

Read the static function without the guard, as [`alternative.f.js`](./alternative.f.js) does:

```js
export default Object.is(1, 1);
```

It answers `true`.

## A Better Message

Today `fjs compile` prints `reserved word` at the refused token. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- ECMA-262: [Optional chains](https://tc39.es/ecma262/#sec-optional-chains)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining>
