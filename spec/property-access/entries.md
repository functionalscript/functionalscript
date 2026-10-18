# Reading an Entry at Run Time

**Status:** implemented

```js
const entry = (a, b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x?.enumerable ? [x.value] : [];
};
const escapes = { n: "\n", t: "\t" };
export default (...c) => entry(escapes, c[0]);
```

A key computed at run time is read by the **`entry` helper**: the function
above, written in a module under any three names, or imported from
[`fjs/types/object/entry`](../../fjs/types/object/entry/module.f.js), which spells it once.
`entry(a, b)` is the **option** of the enumerable own property `b` names of
`a` — a member of an object, an element of an array or of a string: a fresh
one-element array holding the value, `[value]`, an entry holding
`undefined` included, so that `{ x: undefined }` and `{}` come apart — and
the empty array, `[]`, where there is none: a `length`, which an array, a
string and a function own without enumerating it; a function's `name`,
which the language keeps unobservable ([functions](../functions/README.md));
anything of a number, a boolean or a `bigint`; and a name a prototype would
give the value in JavaScript, since the descriptor is the value's own. The
key is converted as `Object.getOwnPropertyDescriptor` converts it, so
`entry(a, 0)` and `entry(a, "0")` read one element and an object key
converts through its own `toString`; a `null` or `undefined` `a` is an
error, as reading a property of one is, and so is a key whose conversion
fails.

The option is an array, `Option<T>` in
[`fjs/types/option`](../../fjs/types/option/types.ts), and composes with
arrays as one: `entry(a, b)[0]` is the value, or `undefined` where there is
none; `entry(a, b).length === 1` is presence; `const [v] = entry(a, b)`
destructures it; `[...entry(a, b), d][0]` is the value or a default, in one
lookup; and `keys.flatMap(k => entry(a, k))` is the values present, in key
order. Presence has no other spelling: `in` is refused
([`in`](../operators/in.md)), and `Object.hasOwn` and
`a.hasOwnProperty(b)` are not in the language, each asking a different
question — a non-enumerable own property, or the prototype chain.

The helper is exactly what it spells. The compiler recognizes the function
whole — its two parameters, the `const` the descriptor binds and the
`return`, under any three distinct names a module may bind, so no keyword
and no reserved global, the keys in either spelling, the
semicolons where JavaScript inserts them — where `Object` is the reserved
global no scope binds ([built-in static functions](../built-ins/static-functions.md));
a function that departs from it by a step is an ordinary function, in which
`Object` is refused at the word as everywhere but `Object.is`. The body that
returned the value itself, `x?.enumerable ? x.value : undefined`, is such a
departure: it read `undefined` alike for an absent key and for an entry
holding `undefined`, and is no longer the helper. It is a
function like any other once recognized: a value, of
`length` `2`, capturing nothing, a fresh identity wherever it is written as
every arrow is, passed as a value — `[a, b].map(entry)` — and converting
to its text as any function does
([function source](../principles/README.md#function-source-representation-exception)). Its EDAG
is the node `['entry']`, the helper as a value, and a read of a computed
key is a call of it, `['()', ['entry'], [a, b]]`
([`fjs/edag`](../../fjs/edag/README.md)); the graph outputs write the node back
as the helper, the FunctionalScript one under names of its own, the Rust
one as a function the VM answers natively. Value outputs can evaluate calls
to the helper; selecting the helper itself is refused as a function value.

The node is the language's one read of a property by a name it computes:
`Object` is no value a module can name, and its namespace admits `is` and
`entries` alone, the second listing every entry rather than reading one
([built-in static functions](../built-ins/static-functions.md)), and `a[i]` stays unread
([property access](README.md)). Where a program knows its index to
be a number, the spelling is `a[Number(i)]`
([property access](README.md)); `a[+i]`, where no `bigint` can reach
it, is [property-accessor](../todo/2330-property-accessor.md)'s still, and
`entry` is the read for a key of any type.

## Examples

The compiler demo offers the programs `entries` in [`module.f.js`](./module.f.js), each with its real output.

## Reference

- ECMA-262: [Object.getOwnPropertyDescriptor](https://tc39.es/ecma262/#sec-object.getownpropertydescriptor)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptor>
