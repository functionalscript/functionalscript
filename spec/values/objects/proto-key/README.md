# A `__proto__:` Key Is Refused

**Status:** refused by design

**`__proto__:` is not FunctionalScript.** `{ __proto__: v }` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

In an object literal, JavaScript reads `__proto__: v` and `"__proto__": v` not as a property but as the object's prototype, so `{ __proto__: [] }` is an object that inherits from an array. FunctionalScript has no prototypes, and giving the key its own-property meaning would make accepted text mean something else than in JavaScript, so the two spellings are refused. The computed key, `["__proto__"]: v`, is an own property in both languages, and is the spelling ([objects](../README.md#the-__proto__-key)).

The row `acc.proto-key` of [refused constructs](../../../todo/refused-constructs.md)
registers the refusal, and [the `__proto__` key](../README.md#the-__proto__-key) gives its reason.

## Examples

```js
export default { __proto__: [] } instanceof Array;
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `true`.

## What to Write Instead

For a property named `__proto__`, write the computed key, as [`alternative.f.js`](./alternative.f.js) does:

```js
export default { ["__proto__"]: [] } instanceof Array;
```

It answers `false`. The object owns a property named `__proto__` and stays a plain object.

## A Better Message

Today `fjs compile` prints `__proto__ requires the computed key form` at the refused token. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- ECMA-262: [Object initializer](https://tc39.es/ecma262/#sec-object-initializer)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Object_initializer#prototype_setter>
