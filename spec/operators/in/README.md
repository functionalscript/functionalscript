# `in` Is Refused

**Status:** refused by design

**`in` is not FunctionalScript.** `"a" in o` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

`"a" in o` is a compilation error, and stays one by design. JavaScript's `in`
asks whether a property exists anywhere on the prototype chain, so
`"toString" in {}` and `"length" in []` are `true`; FunctionalScript has no
prototype chain to consult, and answering for own entries only would give
accepted text a different successful result than JavaScript gives it. Neither
is acceptable, so the operator is refused rather than approximated. To read an
entry, use [`entry`](../../property-access/entries/README.md), and to ask whether
there is one, `hasEntry` beside it: `true` for an enumerable own entry and
`false` for an absent key. The reasons, the
alternatives rejected and what a migration does are in
[the `in` decision](../../todo/2346-in-operator.md), and the row `op.in` of
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

## Reference

- ECMA-262: [Relational operators](https://tc39.es/ecma262/#sec-relational-operators)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/in>
