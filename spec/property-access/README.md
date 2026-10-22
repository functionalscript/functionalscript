# Property Access

**Status:** implemented

```js
const cfg = { ports: [80, 443] };
export default [cfg.ports[0], cfg["ports"].length];
```

A property access reads an **own property** of a value — a member of an
object, an element or the `length` of an array, a code unit or the `length`
of a string, the `length` of a function. Any value takes one: a reference, a
group, an access, a call, or a value written out of any
[type](../values/README.md) — `null`, `undefined`, a boolean, a number, a
`bigint`, a string, an array or an object. A property the value does not own
is `undefined` — `true.x` and `true.length` are, a boolean owning nothing —
and reading one of `null` or `undefined` is an error, as JavaScript throws.

A numeric literal takes an access like anything else: `1 .x` is `undefined`,
written with a space since `1.x` is one number and a stray word, while a
`bigint`'s `n` ends its literal, so `1n.x` needs none. The sign binds looser,
as it does in JavaScript, so `-1 .x` is `-(1 .x)`, `-1n.x` is `-(1n.x)`,
which is `NaN`, and `const n = 1;` followed by `n.x` is `undefined` in both
languages.

The key is a constant — an [identifier](../lexical/identifiers/README.md) after `.`, or a directly
written string or unsigned numeric literal in brackets — and `0` and `"0"` name the same element,
as in JavaScript. A numeric literal names the string JavaScript's `String`
gives its number, which is the number's
[normalized DataJS](../datajs/README.md#normalized-form) spelling: `a[1.0]`,
`a[1e0]` and `a[0.1e1]` are `a["1"]`, `o[1e21]` is `o["1e+21"]`, `o[1e-7]`
is `o["1e-7"]`, and `o[1e400]`, a literal that overflows, is
`o["Infinity"]` — a key the FunctionalScript (`.js`) output refuses to write
(`a number key no literal reads back`). A string in brackets is the key
unchanged, so `a["01"]` and `a["1.0"]` name no element and are `undefined`,
as in JavaScript.

A key computed at run time is the conversion,
`a[Number(i)]` ([number conversion](../conversions/number/README.md)): the property the
number names, its string as JavaScript gives it, so `xs[Number("1")]` and
`xs[1]` read one element, `"abc"[Number(true)]` is `"b"`, and
`xs[Number("x")]`, whose key is `"NaN"`, is `undefined`. It reads an own
property as every access does, and no prototype name is a number's string,
so nothing is refused at a converted key; `a[Number(i)](x)` calls what it
reads with `a` as the receiver, as `a[0](x)` does. Its base and its key are
both evaluated, as in JavaScript, though not in a promised order: where both
fail, which fails first is no observation
([failure is one outcome](../principles/README.md#failure-is-one-outcome)). `a?.[Number(i)]`
evaluates the key only where `a` is neither `null` nor `undefined`
([optional chaining](optional-chaining/README.md)).
Anything else in the brackets is a compilation error
(`computed key is not Number(...)`), at the token it begins with: `a[i]`,
whose type the compiler does not know — a key of any type is the `entry`
helper's to read ([reading an entry at run time](entries/README.md))
— and every other expression, `a[-1]` and `a[NaN]` included, whose keys
are written as strings instead, `a["-1"]` and `a["NaN"]`. A grouped literal
key, `a[(0)]` or `a[("x")]`, is also refused; a grouped conversion,
`a[(Number(i))]`, is accepted. Trivia, a line break included, may stand on either side of the
`.` or the `[` and inside the brackets, as between any two tokens
([trivia](../lexical/whitespace/README.md)): `a . b`, `a./* c */b` and `a`
with `.b` on the next line are each `a.b`, as JavaScript reads them.

FunctionalScript has no prototype chains, so a name a built-in prototype
gives a value — `push`, `toString`, `valueOf`, `constructor`, `__proto__`
and the rest, listed in [`fjs/js/prototype`](../../fjs/js/prototype/module.f.js)
— is a **compilation error** as the key of an access, in either spelling,
`o.toString` or `o["toString"]` (`prohibited property name`): JavaScript
would find a function there and this language nothing, and a module must
mean one thing in both. The rule refuses reading such a name, not owning it:
an object literal may hold one, `{ toString: 1 }`
([property keys](../values/objects/README.md#property-keys)). `length` is the exception, since an
array, a string and a function own it. The rules are
[property-accessor](../todo/2330-property-accessor.md)'s.

A method call has a rule of its own. `a.push(1)`, `a.valueOf()` and the
other member functions
[`fjs/js/prototype`](../../fjs/js/prototype/module.f.js)'s `prohibitedCalls`
names are compilation errors (`prohibited member function`) — one row per
name, with the reason, in [its README](../../fjs/js/prototype/README.md). Every
other prototype name but `length` is on its `allowedCalls`, and a call of one
— `a.toString()`, `[1, 2].at(0)`, `a.map(f)` — calls the receiver type's
built-in, as in JavaScript, an own property of the name shadowing the
built-in and a type without one throwing as JavaScript does. The read stays
refused where the call is allowed, since a detached built-in is a function
that only fails. `length` is on neither list: `a.length(1)` calls whatever
`a` owns there, as JavaScript does, so a function an object holds under
`length` is called, and anything else — an array's, a string's or a
function's `length` is a number — throws the `TypeError` JavaScript throws.

## Pages

- [Optional Chaining](./optional-chaining/README.md)
- [Reading an Entry at Run Time](./entries/README.md)

Refused by design, each page showing what `fjs compile` prints and what to write instead:

- [A Prototype's Method Is Refused](./prototype-calls/README.md)
- [A Prototype's Name Is Refused](./prototype-names/README.md)
- [A Key Computed at Run Time Is Refused](./runtime-keys/README.md)

## Examples

The compiler demo offers the programs `index` in [`module.f.js`](./module.f.js), each with its real output.

The demo on this page runs [`sample.f.js`](./sample.f.js), this page's
example as a function of one number — a property read with `.`, a computed
index, and a string key — with every output `fjs compile` makes of it: the
expression graph (EDAG), the Rust and the WebAssembly that Rust builds to.
Its Run button calls the default export with `0` and `1`, as JavaScript and
as WebAssembly, and shows what each call returned or threw.

```js
const cfg = { ports: [80, 443] };
export default (...a) => [cfg.ports[Number(a[0])], cfg["ports"].length];
```

## Reference

- ECMA-262: [Property accessors](https://tc39.es/ecma262/#sec-property-accessors)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Property_accessors>
