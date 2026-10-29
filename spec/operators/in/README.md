# `in` Is Refused

**Status:** refused; the operator with a string-literal key is planned

**`in` is not FunctionalScript yet.** `"a" in o` is valid JavaScript, and
`fjs compile` refuses it today: the demo below shows what it prints. The
operator with a string-literal key that names no prototype property, `"a" in o`
for the enumerable own entry `a`, is planned
([the `in` record](../../todo/2346-in-operator.md)); the general operator, with
a computed key or a prototype name, stays out for the reasons below.

`"a" in o` is a compilation error today. JavaScript's `in`
asks whether a property exists anywhere on the prototype chain, so
`"toString" in {}` and `"length" in []` are `true`; FunctionalScript has no
prototype chain to consult, and answering for own entries only would give
accepted text a different successful result than JavaScript gives it. Neither
is acceptable for a key the chain can answer, so the general operator is
refused rather than approximated; a literal key outside the chain's names is
the planned operator's. To read an
entry, use [`entry`](../../property-access/entries/README.md), and to ask whether
there is one, `hasEntry` beside it: `true` for an enumerable own entry and
`false` for an absent key. The reasons, the
alternatives rejected and the planned operator are in
[the `in` record](../../todo/2346-in-operator.md), and the row `op.in` of
[refused constructs](../../todo/refused-constructs.md) registers the refusal.

## Examples

```js
export default "toString" in {};
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `true`, an empty object's `toString` found on the prototype chain,
the answer FunctionalScript would have to give or contradict.

## What to Write Instead

To ask whether a value has an own entry, call `hasEntry`
([entries](../../property-access/entries/README.md)), as
[`alternative.f.js`](./alternative.f.js) does:

```js
const hasEntry = (a, b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x?.enumerable === true;
};
export default hasEntry({}, "toString");
```

It answers `false`: `{}` owns no `toString`. That is a different question
from the one `in` asks, which is why `in` is not given this meaning.

## A Better Message

Today `fjs compile` says only where it stopped, `unexpected token` at the
`in`. The demo proposes what it should print instead: the reason at the same
token, what JavaScript would answer there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative too,
so the suggestion is one the compiler accepts.

## Reference

- ECMA-262: [Relational operators](https://tc39.es/ecma262/#sec-relational-operators)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/in>
