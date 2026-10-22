# `instanceof` Other Than `Array` Is Refused

**Status:** refused by design

**`instanceof` is not FunctionalScript.** `[] instanceof Map` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

`x instanceof Array` is in the language ([`instanceof`](../README.md)): an array is the one kind of value with a class of its own. Any other right operand is refused, since JavaScript answers it by walking the prototype chain of `x` for that class's `prototype`, and FunctionalScript has neither the chain nor other classes to name.

The row `op.instanceof` of [refused constructs](../../../todo/refused-constructs.md)
registers the refusal, and [`instanceof`](../README.md) gives its reason.

## Examples

```js
export default [] instanceof Map;
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `false`.

## What to Write Instead

Ask whether a value is an array with `instanceof Array`, as [`alternative.f.js`](./alternative.f.js) does:

```js
export default [] instanceof Array;
```

It answers `true`.

## A Better Message

Today `fjs compile` prints `the right operand of instanceof must be Array` at the refused token. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- ECMA-262: [InstanceofOperator](https://tc39.es/ecma262/#sec-instanceofoperator)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/instanceof>
