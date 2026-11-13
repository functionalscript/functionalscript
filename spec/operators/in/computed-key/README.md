# `in` With a Computed Key Is Refused

**Status:** refused by design

**`k in o` is not FunctionalScript.** `k in o`, with a key computed at run time, is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

`"k" in o` is in the language ([`in`](../README.md)): a string literal as the key, which the compiler reads and checks against the names a built-in prototype gives a value. A key it cannot read it cannot check, and JavaScript answers such a key from the prototype chain, which FunctionalScript does not have, so any left operand but a string literal is refused at the operator — a name, a number, an operator's result, an `in` of its own.

The row `op.in` of [refused constructs](../../../todo/refused-constructs.md)
registers the refusal, and [`in`](../README.md) gives its reason.

## Examples

```js
const k = "a";
export default k in { a: 1 };
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `true`.

## What to Write Instead

Ask whether a value has an own entry under a computed key with `hasEntry`
([reading an entry](../../../property-access/entries/README.md)), as
[`alternative.f.js`](./alternative.f.js) does:

```js
const hasEntry = (a, b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x?.enumerable === true;
};
const k = "a";
export default hasEntry({ a: 1 }, k);
```

It answers `true`, as JavaScript does for the sample: the object owns the
entry, and for a key no prototype supplies the two questions agree.

## A Better Message

Today `fjs compile` prints `the left operand of in must be a string literal` at the operator. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- ECMA-262: [Relational operators](https://tc39.es/ecma262/#sec-relational-operators)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/in>
