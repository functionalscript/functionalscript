# Boolean Conversion

**Status:** implemented

```js
export default [Boolean(0), Boolean("false"), Boolean([]), Boolean()];
```

`Boolean(exp)` converts its operand to a boolean. Its common runtime body is
`value => !!value`: `undefined`, `null`, `false`, both numeric zeros, `NaN`,
`0n` and the empty string become `false`; every other value becomes `true`.
Arrays, objects and functions are truthy, including an empty array or object.
The nonempty strings `"false"` and `"0"` are truthy too.

The operand is evaluated once. Conversion reads no object properties and
calls neither `valueOf` nor `toString`; an object with throwing conversion
methods is still truthy. A failure while evaluating the operand propagates
([failure is one outcome](../../principles/README.md#failure-is-one-outcome)).

The compiler preserves the conversion as `['Boolean', exp]` in EDAG, with no
front-end truthiness folding. Every executor runs the same
[common runtime body](../../../fjs/js/runtime/module.f.js), which uses the
existing logical-not operator. `Boolean()` supplies `undefined`, so its graph
is `['Boolean', ['undefined']]` and its result is `false`. The writer may spell
this normalized form as `Boolean(undefined)`.

**`Boolean` is a reserved global**, under the same
[global-name rule](../../todo/2365-global-names.md) as the other conversions.
A module cannot bind or shadow it, and the word has no standalone value:
`const convert = Boolean;` and `Boolean.prototype` are refused (`reserved word`).
Ordinary property names remain ordinary: `{ Boolean: 1 }.Boolean` is `1`.

The conversion is an operator, not a function
([operators and functions](../../principles/README.md#operators-and-functions)).
It takes zero or one plain operand. Multiple arguments and spreads are
refused at the word (`Boolean takes one argument`), following the existing
conversion-operator arity rule rather than JavaScript's ignored extra arguments.
`Boolean?.(value)` is refused (`reserved word`) because the operator is no
value to guard. A computed numeric property key still requires `Number(...)`;
`a[Boolean(value)]` is refused.

## Examples

The compiler demo offers `Boolean conversion` in
[`module.f.js`](../module.f.js), with its real output.

The demo on this page runs [`sample.f.js`](./sample.f.js), calling the same
program as JavaScript and WebAssembly with `0` and `1`. It converts the input,
an omitted operand, a nonempty string, an empty array and an empty object:

```js
export default (...a) => [Boolean(a[0]), Boolean(), Boolean("false"), Boolean([]), Boolean({})];
```

## Reference

- [ECMA-262: ToBoolean](https://tc39.es/ecma262/#sec-toboolean)
- [MDN: Boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean/Boolean)
