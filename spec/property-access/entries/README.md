# Reading an Entry at Run Time

**Status:** implemented

```js
const entry = (a, b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x?.enumerable ? x.value : undefined;
};
const hasEntry = (a, b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x?.enumerable === true;
};
const escapes = { n: "\n", t: "\t" };
export default (...c) => hasEntry(escapes, c[0]) ? entry(escapes, c[0]) : c[0];
```

A key computed at run time is read by the **`entry` helper** and tested by
the **`hasEntry` helper**: the two functions above, written in a module
under any three names each, or imported from
[`fjs/types/object/entry`](../../../fjs/types/object/entry/module.f.js), which spells them once.
`entry(a, b)` is the **value** of the enumerable own property `b` names of
`a` — a member of an object, an element of an array or of a string — and
`undefined` where there is none: a `length`, which an array, a string and a
function own without enumerating it; a function's `name`, which the
language keeps unobservable ([functions](../../functions/README.md)); anything
of a number, a boolean or a `bigint`; and a name a prototype would give the
value in JavaScript, since the descriptor is the value's own. `hasEntry(a, b)`
is the **presence**, `true` where there is one, an entry holding `undefined`
included, so that `{ x: undefined }` and `{}` come apart, and `false`
where there is none. The key is converted as `Object.getOwnPropertyDescriptor`
converts it, so `entry(a, 0)` and `entry(a, "0")` read one element and an
object key converts through its own `toString`; a `null` or `undefined` `a`
is an error, as reading a property of one is, and so is a key whose
conversion fails.

The pair composes as reads do: `entry(a, b) ?? d` is the value or a
default, as `a[k] ?? d` is, the default taken for an entry holding
`undefined` too; where that entry must keep its `undefined`,
`hasEntry(a, b) ? entry(a, b) : d` reads twice and keeps it; and
`keys.filter(k => hasEntry(a, k))` is the keys present, in key order.
Presence has no other spelling: `in` is refused
([`in`](../../operators/in.md)), and `Object.hasOwn` and
`a.hasOwnProperty(b)` are not in the language, each asking a different
question — a non-enumerable own property, or the prototype chain.

The helpers are exactly what they spell. The compiler recognizes each
function whole — its two parameters, the `const` the descriptor binds and
the `return`, under any three distinct names a module may bind, so no
keyword and no reserved global, the keys in either spelling, the
semicolons where JavaScript inserts them — where `Object` is the reserved
global no scope binds ([built-in static functions](../../built-ins/static-functions/README.md));
a function that departs from either by a step is an ordinary function, in
which `Object` is refused at the word as everywhere but `Object.is`. The
body that returned the option, `x?.enumerable ? [x.value] : []`, is such a
departure now. Each is a function like any other once recognized: a value,
of `length` `2`, capturing nothing, a fresh identity wherever it is written
as every arrow is, passed as a value — `[a, b].map(entry)` — and
converting to its text as any function does
([function source](../../principles/README.md#function-source-representation-exception)). Its EDAG
is the node `['entry']` or `['hasEntry']`, the helper as a value, and a
read of a computed key is a call of it, `['()', ['entry'], [a, b]]`
([`fjs/edag`](../../../fjs/edag/README.md)); the graph outputs write the node back
as the helper, the FunctionalScript one under names of its own, the Rust
one as a function the VM answers natively. Value outputs can evaluate calls
to the helpers; selecting a helper itself is refused as a function value.

The node is the language's one read of a property by a name it computes:
`Object` is no value a module can name, and its namespace admits `is` and
`entries` alone, the second listing every entry rather than reading one
([built-in static functions](../../built-ins/static-functions/README.md)), and `a[i]` stays unread
([property access](../README.md)). Where a program knows its index to
be a number, the spelling is `a[Number(i)]`
([property access](../README.md)); `a[+i]`, where no `bigint` can reach
it, is [property-accessor](../../todo/2330-property-accessor.md)'s still, and
`entry` is the read for a key of any type.

## Why two helpers

The language first answered both questions with one helper, the option
`[value]` or `[]`, chosen for one scan per question: value, presence, or a
default that respects an entry holding `undefined`, each one call, where
the pair spends two scans on the third. That argument held until the
runtime's dispatcher, `dot`, was written in the language
([runtime-members](../../../fjs/js/todo/runtime-members.md),
[DESIGN.md §13](../../../doc/DESIGN.md#13-one-source-of-truth-optimize-by-substitution)),
and the language designer decided for the pair:

- **The common read has no tail.** `entry(a, b)` is the value, as `a[k]`
  is, where the option made every read `entry(a, b)[0]`.
- **Nothing is built on a member call.** `dot` reads the receiver and
  then the member table, and with the option each read built a
  one-element array to carry one bit, on the path of every compiled
  `a.map(f)`; with the pair, `hasEntry(self, key) ? entry(self, key)`
  then the body, it allocates nothing.
- **The shape is in the source, not in a rule.** A backend could print
  the option's presence test without the array, but that is a
  substitution keyed on a body's text, which §13 says is a sign the
  source should expose the shape instead. `hasEntry` is the shape.
- **The floor is simpler.** The core of the runtime may not use what it
  defines, and with the option it read `[0]` of `entry`'s answer, a
  property read, to get at the value. With the pair presence is a
  boolean and the value is the value.

The price: two scans where presence and value are both wanted on a
receiver that owns the key, each one lookup, against the option's one
lookup and one allocation — which of the two is dearer is not measured,
and the decision does not rest on it; an own `undefined` invisible to
`entry` alone, which `hasEntry` tells apart, as JavaScript's `in` and
`Object.hasOwn` callers do; and two recognized bodies, two nodes and two
native answers on each executor where the option had one of each. The
option stays available as an ordinary function over the two,
`hasEntry(a, b) ? [entry(a, b)] : []`, for a caller that wants it. The
decision was recorded in `spec/todo/2345-has-entry.md`, its three tasks
done by #3037, #3038 and #3031.

## Examples

The compiler demo offers the programs `entries` in [`module.f.js`](../module.f.js), each with its real output.

The demo on this page runs [`sample.f.js`](./sample.f.js), this page's
example as a function of one number — reading an entry at run time: one that
exists, and one that does not — with every output `fjs compile` makes of it:
the expression graph (EDAG), the Rust and the WebAssembly that Rust builds
to. Its Run button calls the default export with `0` and `1`, as JavaScript
and as WebAssembly, and shows what each call returned or threw.

## Reference

- ECMA-262: [Object.getOwnPropertyDescriptor](https://tc39.es/ecma262/#sec-object.getownpropertydescriptor)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptor>
