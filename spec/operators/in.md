# `in` Is Refused

**Status:** refused by design

`"a" in o` is a compilation error, and stays one by design. JavaScript's `in`
asks whether a property exists anywhere on the prototype chain, so
`"toString" in {}` and `"length" in []` are `true`; FunctionalScript has no
prototype chain to consult, and answering for own entries only would give
accepted text a different successful result than JavaScript gives it. Neither
is acceptable, so the operator is refused rather than approximated. To read an
entry, or to ask whether there is one, use
[`entry`](../property-access/entries.md), which answers an option: `[value]`
for an enumerable own entry and `[]` for an absent key, so
`entry(o, k).length === 1` is the presence test. The reasons, the
alternatives rejected and what a migration does are in
[the `in` decision](../todo/2346-in-operator.md).

## Examples

No programs yet: this page's accepted and refused examples are a follow-up.

## Reference

- ECMA-262: [Relational operators](https://tc39.es/ecma262/#sec-relational-operators)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/in>
