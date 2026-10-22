# Destructuring

**Status:** implemented

```js
const { a, "%": [c, d], length } = { a: null, "%": [true, false] };
export const { x, y } = { x: 1, y: [2] };
const f = ([first, { second }], ...r) => [first, second, r];
export default [a, c, d, length, f];
```

A `const`, a module's or a body's, exported or not, and a fixed
[parameter](../../functions/parameters/README.md) may bind a **pattern** in place of a name: an
object pattern, `{ p, … }`, each property a shorthand name or a key and a
target, `a: t`, `"a": t`, `["a"]: t`, `[3]: t`; or an array pattern,
`[t, …]`, each item a target or an elision, `[, t]`; a target a name or a
pattern again, and a trailing comma allowed as the literals allow one. Each name is a binding
by the rule above — reserved, refused twice, exported as `then`, or
shadowing a capture, it is refused as a name alone is — and it names the
part of the value its path reads, as in JavaScript. The initializer is
evaluated once, however many names read it.

A pattern is sugar over reads the language has, and that is its whole
semantics: the graph outputs write the reads, `const [c, d] = v;` as
`const $0=[...v];const c=$0[0];const d=$0[1];`, as a guard is written as
its conditional ([functions](../../functions/README.md)).

- An object pattern's property is the [property access](../../property-access/README.md)
  its key spells, with every rule of one: a `null` or `undefined` source
  throws, as JavaScript's `RequireObjectCoercible` throws; a primitive
  source binds what it owns — a string its code units by index, `const { [0]: first } = "ab";` binding `"a"`, and its `length`;
  a number, a boolean or a `bigint` nothing — and `undefined` for a
  property it does not own, as `GetV` reads through `ToObject`;
  `length` reads an array's, a string's or a function's; and a key a
  built-in prototype gives a value, `toString`, `constructor` or
  `__proto__`, is the compilation error the access is (`prohibited
  property name`), since JavaScript would read a function there and this
  language nothing.
- An array pattern is the [spread](../../values/arrays/README.md#spread) of its source and reads of the
  array the spread made, which is JavaScript's own reading: array
  destructuring runs through `GetIterator` as a spread does, so a source
  that is not iterable throws the same `TypeError` — `const [a] = {};`
  fails here as it fails there — and a string yields its code points,
  `const [a] = '😀';` binding the two-unit string. The spread reads every
  element where JavaScript's destructuring stops at the last target; no
  program here can observe the difference, there being no generator, no
  side effect and no infinite iterable.
- An **elision**, `[, b]` or `[a, , c]`, skips a position: it binds and
  reads nothing, and the element after it reads the next index of the
  spread, so `const [, b] = v;` is `const $0=[...v];const b=$0[1];`. One
  after the last element, `[a, ,]`, is a position nothing reads, and
  elisions alone, `const [,] = v;`, bind nothing and keep the spread's
  failure, as the empty pattern below does. It is a pattern's alone: in a
  value the same comma is a hole, which no array of this language has,
  refused by design (`array hole`, [arrays](../../values/arrays/README.md)).
- Every read is established whether or not a name reads it, as every
  `const` is ([shared values](../constants/README.md)):
  `const { a: { b } } = {};` throws at load, as it throws in JavaScript.
  Which of a pattern's reads fails first is no observation
  ([failure is one outcome](../../principles/README.md#failure-is-one-outcome)).
- An **empty pattern** binds nothing and keeps its failure, the check
  JavaScript gives a caller through it: `const [] = v;` is the spread of
  `v` alone and fails where `v` is not iterable, and `const {} = v;` reads
  one property of `v`, its `length`, which every kind of value may own,
  binding nothing — the read that fails where `v` is `null` or
  `undefined`, as `RequireObjectCoercible` fails, and whose value is no
  observation. The graph outputs write the two reads, `const $0=[...v];`
  and `const $0=v.length;`. An exported pattern exports each name it binds,
  so `export const {} = o;` exports nothing, and a module whose exports all
  bind no name is refused, as one with no export is
  ([exports](../../modules/exports/README.md)): `module exports nothing`, at its last
  `export`.
- A pattern names no function as its whole value, so no name in it is a
  function's own ([captures and self recursion](../../functions/captures/README.md)):
  `const { f } = { f: () => f };` is `const not found`.
- An object pattern over a **namespace**, `Object` or `Number`, reads its
  members ([built-in static functions](../../built-ins/static-functions/README.md)), there
  being no value to read them from: `const { is } = Object;` is
  `const is = Object.is;`, one entry, `const { isInteger } = Number;` is
  `const isInteger = Number.isInteger;`, and `const {} = Object;` reads
  nothing, the namespace being never nullish. A key the namespace admits
  is read whatever it spells, so `const { entries } = Object;` is
  `const entries = Object.entries;` though `entries` is a prototype name.
  An array pattern over it, and a key it does not admit, are refused at
  the word (`reserved word`) — but a key it does not admit that is a
  prototype name, `keys` or `toString`, is refused first, at the key, as
  in any pattern (`prohibited property name`).
- A **parameter pattern** is one fixed parameter, its source the argument
  in its position: `([a, { b }], c) => …` binds `a` and `b` from the first
  argument as `const [a, { b }] = arg;` would, its reads the first entries
  of the function's body, so `(([]) => 0)({})` and `(({}) => 0)(null)`
  fail as they fail in JavaScript, whether the body is a block or an
  expression. It counts as one toward `length` and toward the limit of 16,
  as JavaScript counts it: `(({ a, b }) => 0).length` is `1`. Its names
  are parameters by every rule of one — refused twice across the list,
  `({ a }, a) => 1`, and against a body declaration — and a nested
  function captures them as it captures any parameter. The rest parameter
  keeps a plain name: `(...[a]) => 1`, harmless JavaScript, is not read
  yet and stops at its `[`. The head of a list is read as a value, one
  symbol telling no list from a group before the `)`, so a head that is
  no name and no pattern is refused for the list (`malformed parameter
  list`, at its `(`) — `(1) => 2`, `(a.b) => 1`, `((a)) => 1` — where a
  value inside the head's pattern is refused where it stands, as in a
  `const`.

Refused, each by name, and open in
[destructuring](../../todo/2450-destructuring.md): a **rest element**,
`[a, ...r]` or `{ a, ...r }` (`rest element not supported`); a
**default**, `{ a = 1 }` or `[a = 1]`, which is no literal and stops at
its `=`; and a **computed key**
beyond a constant — a string or a number literal alone in the brackets,
`{ ["a"]: t }` or `{ [3]: t }`, is the constant key an access admits in
brackets ([property access](../../property-access/README.md)), read by the literal's
spelling as `"a": t` is, while `{ [k]: a }`, `{ [Number(i)]: a }` and a
grouped literal, `{ [(3)]: a }`, are refused (`computed key in a binding
pattern not supported`). A value in a binding position —
a literal, an access, a call, an operator, or a group, `[(a)]`, which
JavaScript admits in an assignment and refuses in a binding — is the error
JavaScript names (`invalid destructuring target`), at the token it begins
with.

See
<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment>.

## Examples

The compiler demo offers the programs `destructuring` in [`module.f.js`](../module.f.js), each with its real output.

The demo on this page runs [`sample.f.js`](./sample.f.js), this page's
example as a function of one number — an object and an array pattern in a
body, and patterns and a rest in a parameter list — with every output `fjs
compile` makes of it: the expression graph (EDAG), the Rust and the
WebAssembly that Rust builds to. Its Run button calls the default export
with `1` and `5`, as JavaScript and as WebAssembly, and shows what each call
returned or threw.

## Reference

- ECMA-262: [Destructuring binding patterns](https://tc39.es/ecma262/#sec-destructuring-binding-patterns)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring>
