# Objects

**Status:** implemented

```js
export default {
    a: "hello",
    "b": 2,
    ["c"]: [1, 2],
};
```

An object may be empty and may end with a trailing comma, like an array. When
one key is written twice, the last value wins, as in JavaScript.

A member may be a name alone, the **shorthand** JavaScript reads as the name
twice, `{ a }` for `{ a: a }`: the name is the key, and a reference to the
name — a `const`, an import, a parameter — is the value, resolved and refused
as any reference is, so `{ b }` with nothing binding `b` is an error, as is
`{ typeof }` — and `{ NaN }`, since `NaN`, `Infinity` and `undefined` are
[reserved words](../numbers/README.md) that denote a value and name no binding. Only the
identifier spelling has the shorthand: `{ "a" }` and `{ ["a"] }` are errors,
the key alone being no reference.

```js
const a = 1;
const b = [a];
export default { a, b, c: 3 };   // { a: 1, b: [1], c: 3 }
```

## Object Spread

A member may be a **spread**, `...` and any value, at any position and any
number of times:

```js
const o = { a: 1, b: 2 };
export default [{ ...o, c: 3 }, { a: 0, ...o }, { ...o, a: 0 }, { ...'ab' }, { ...null }];
// [{ a: 1, b: 2, c: 3 }, { a: 1, b: 2 }, { a: 0, b: 2 }, { 0: 'a', 1: 'b' }, {}]
```

The operand is evaluated in its place among the members, left to right, and
its own enumerable string-keyed properties are copied in, in its own
property order, as JavaScript's `CopyDataProperties` copies them. A copied
key behaves as a written one: when it is already present, the later value
wins and the key keeps its first position. What each value contributes
agrees with JavaScript:

- **An object:** its own properties, array-index keys first in ascending
  order, then the others in the order they were made.
- **An array:** its elements, keyed `'0'`, `'1'`, ….
- **A string:** one property per UTF-16 code unit, not per code point:
  `{ ...'😀' }` is `{ 0: '\ud83d', 1: '\ude00' }`, where `[...'😀']` is
  `['😀']`. The two spreads read a string differently in JavaScript, and so
  here.
- **Anything else** — `null`, `undefined`, a boolean, a number, a `bigint`,
  a function — contributes nothing: `{ ...null }` is `{}`.

So, unlike an [array's spread](../arrays/README.md#spread), copying these properties never
throws; evaluating the operand still may. A function contributes nothing:
`export default { ...(() => 1) };` writes `{}` as JSON and
`export default {};` as DataJS. Graph outputs preserve the spread
([output](../../command-line/output.md)). A
copied `__proto__` key is an ordinary own property, as JavaScript's
`CreateDataProperty` makes it: `{ ...{ ['__proto__']: 1 } }` owns a
property named `__proto__` and has no new prototype
([the `__proto__` key](#the-__proto__-key)).

The value outputs write the object the spread made, and the graph outputs
the spread itself: `.js` and `.f.js` write it back, `{ ...o, c: 3 }`, the
EDAG keeps its `['...', exp]` entry, and `.rs` prints it through
`nanvm-lib`'s `object_spread`. A constant spread is not folded, so
`{ ...{ a: 1 } }` is a different graph from `{ a: 1 }`. With a spread among
the members, which keys the literal has is known only once the operand is:
no key selects inside such a literal during source reconstruction, and no
member before a spread is dropped as overwritten. Value outputs instead
evaluate the members and spreads before selecting and serializing the result.

A member may hold any value, `undefined` included, and a member holding
`undefined` is still an own property, as in JavaScript: it keeps its key and
that key's position, so `{ x: undefined }` is not `{}`, although reading `x`
gives `undefined` from both. `{ x: 1, x: undefined }.x` is `undefined`, and
`{ x: undefined, y: 2, x: 3 }` has the keys `x` and `y`, in that order. A
DataJS or FunctionalScript output writes the member, `{"x":undefined}`; a
`.json` output refuses it rather than drop it the way `JSON.stringify` does
([output](../../command-line/output.md)).

## Property Keys

A key is written in one of three ways:

|Form|Example|
|----|-------|
|string literal|`{ "a": 1 }`|
|identifier|`{ a: 1 }`|
|computed|`{ ["a"]: 1 }`, `{ [k]: 1 }`|

The first two spell a constant key. The brackets of a computed key hold any
value, as an index's do: a string literal there is the same constant key by
a third spelling, and the three spellings mix freely inside one object. An
identifier key is an [identifier](../../lexical/identifiers/README.md) — ASCII letters, digits, `_`
and `$`, not starting with a digit — and may be a reserved word, `{ if: 1 }`,
as it may in JavaScript. A key no identifier spells is written as a string:
`{ "é": 1 }`, `{ "a-b": 1 }`.

Any other value in the brackets is a **computed key**. `sergey-shandar`
approved the design in
[#2828](https://github.com/functionalscript/functionalscript/pull/2828#issuecomment-6111260970),
as [DESIGN.md §12](../../../doc/DESIGN.md#new-language-features-start-with-a-todo)
requires. The key is evaluated where the object is built — after the
members before it and before its own value, as JavaScript evaluates a
literal — and converted to a property key as JavaScript's `ToPropertyKey`
converts it: a string is the key, and every other value is the string it
converts to, `[1]` the key `"1"`, `[null]` the key `"null"`, `[[1, 2]]` the
key `"1,2"`:

```js
const k = 'a';
export default (i) => ({ [k]: 1, [k + 'b']: 2, [i]: 3 });
// ({ a: 1, ab: 2, [i]: 3 }); called with 0, { a: 1, ab: 2, 0: 3 }
```

A computed key that is a constant is that constant: `{ ["a"]: 1 }` and
`{ a: 1 }` are the same literal, and so is
`const k = 'a'; export default { [k]: 1 };`, `k` being the literal it is
bound to. The graph outputs write a key that is no constant string in
brackets, as it was read, `{ [i]: 3 }` and `{ [0]: 1 }`; the value outputs
write the key the value has, `{ "0": 1 }` ([output](../../command-line/output.md)).

A key may be any name, including one a built-in prototype gives a value:
`{ constructor: 1, toString: 2, push: 3 }` is an object that owns those three
properties, as in JavaScript, whichever spelling each key takes. What
[property access](../../property-access/README.md) refuses is reading such a member back,
not owning it, and `__proto__` is the one key with a rule of its own
([below](#the-__proto__-key)).

A numeric key literal such as `{ 3e7: true }` is not recognized yet — see
the [roadmap](../../todo/README.md); `{ [3e7]: true }` is the same object.

## The `__proto__` Key

JavaScript gives the three spellings of a `__proto__` key two different
meanings:

```js
{ __proto__: v }      // sets [[Prototype]]; no own property
{ "__proto__": v }    // sets [[Prototype]]; no own property
{ ["__proto__"]: v }  // an ordinary own property named "__proto__"
```

Only the bracketed spelling denotes a property, so it is the only keyed one
FunctionalScript accepts. The other two are compilation errors:

```js
export default { __proto__: 1 };    // error
export default { "__proto__": 1 };  // error
export default { ["__proto__"]: 1 }; // ok
```

**The bracketed form is the workaround**: it is how a module holds a property
actually named `__proto__`. The [shorthand](#objects) `{ __proto__ }` is the
other way, and denotes the same own property, as it does in JavaScript, where
the prototype rule names the keyed spellings alone.

FunctionalScript has no prototype chains at run time
([property-accessor](../../todo/2330-property-accessor.md)), so a spelling whose
only meaning is "assign a prototype" has no meaning to give. Rejecting it is
the whitelist principle rather than a special case, and it keeps principle 2:
a module means on the FunctionalScript VM what it means on any other
JavaScript engine.

A value may still carry a `__proto__` property; what a module cannot do is
*read* it with `o.__proto__`, which is a separate rule of
[property-accessor](../../todo/2330-property-accessor.md).

### The one key the two languages read differently

`"__proto__"` is an ordinary data key in a JSON document — `JSON.parse` makes
it an own property — and a prototype assignment in a JavaScript module. It is
the only text the two languages disagree about; every other JSON document
denotes the same value in both.

Each language keeps its own reading, because each is right about itself:
JSON's reader gives the document the value `JSON.parse` gives it, and the
module parser refuses the spelling rather than give a module a value no
JavaScript engine would give it.

So `fjs compile` reads and writes the key differently in each language, and
the extension of each file **named on the command line** picks the language:

```sh
fjs compile input.f.js output.data.js   # {["__proto__"]:1}
fjs compile input.f.js output.json      # {"__proto__":1}
fjs compile input.json  output.data.js  # reads {"__proto__":1} as a property
```

A JSON document therefore survives the loop `proto.json → a.data.js → out.json`
byte for byte, each hop spelling the key its own language's way. The
disagreement is about a *text*, not a value, so nothing is unreachable.

The identifier spelling is not a key in either language: no JSON document
contains one, so `{ __proto__: 1 }` is an error whatever the input file is
called.

In JavaScript output the bracketed form is what makes the module round-trip —
of the keyed spellings it is the only one whose evaluation reproduces the
property, and the writer has no other, since the [shorthand](#objects) needs
a binding named `__proto__` to refer to and an output binds none. In JSON
output the plain key stays: `JSON.parse` has no prototype special case, so
JSON already round-trips, and the bracketed form is not JSON at all.

## Examples

The compiler demo offers the programs `objects` in [`module.f.js`](../module.f.js), each with its real output.

The demo on this page runs [`sample.f.js`](./sample.f.js), this page's
example as a function of one number — an object literal with an identifier
key, a string key and a computed key — with every output `fjs compile` makes
of it: the expression graph (EDAG), the Rust and the WebAssembly that Rust
builds to. Its Run button calls the default export with `1` and `2`, as
JavaScript and as WebAssembly, and shows what each call returned or threw.

```js
export default (...a) => {
    const o = { a: "hello", "b": a[0], ["c"]: [1, 2] };
    return Object.entries(o).length + o.b;
};
```

## Reference

- ECMA-262: [Object initializer](https://tc39.es/ecma262/#sec-object-initializer)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Object_initializer>
