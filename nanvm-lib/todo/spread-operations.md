## Spread operations on `Any`

**Priority:** P3
**Status:** open

### Problem

The EDAG already has a spread entry, `['...', exp]`, valid only inside an
array's items or an object's properties
([`fjs/edag/README.md`](../../fjs/edag/README.md), `Items` and `Properties` in
[`fjs/edag/types.ts`](../../fjs/edag/types.ts)). A call's arguments are one
array node, so `f(a, ...b)` is `['()', f, ['[]', [a, ['...', b]]]]` and needs
nothing more. The JS evaluator in
[`fjs/edag/operations`](../../fjs/edag/operations/module.f.mjs) runs both
entries with JavaScript's semantics. The Rust writer,
[`fjs/edag/rust`](../../fjs/edag/rust/module.f.mjs), refuses both: `Any` has
no operation for either.

The type of a spread's operand is unknown when the graph is built, so each
spread needs one operation on `Any` that dispatches on the value it gets. The
container decides which one: inside `[]` the operand is iterated, inside
`{}` its own properties are copied. The two operations are not the same
reading of a value, and they differ even on strings:

```js
[...'😀']   // ['😀']: one code point
{...'😀'}   // { 0: '\ud83d', 1: '\ude00' }: two code units
[...{}]     // throws: an object is not iterable
{...1}      // {}: a number has no own properties
```

### Proposal

Two methods on `Any`, named for what they read, not after `Object.values`,
which accepts any object where `[...{}]` throws.

```rust
/// The elements iterating `self` yields — ECMAScript's
/// `GetIterator(self)`: an array's elements, a string's code points; any
/// other value is not iterable and throws.
fn iterable(self) -> Result<impl Iterator<Item = Any<A>>, Any<A>>

/// The own enumerable string-keyed properties of `self`, in
/// `[[OwnPropertyKeys]]` order — what `{...self}` copies: `null`,
/// `undefined` and other primitives have none, and nothing throws.
fn own_entries(self) -> impl Iterator<Item = (String<A>, Any<A>)>
```

**`iterable`** is JavaScript iteration restricted to the values a module can
build. FunctionalScript has no `Map`, `Set` or generators, so only two
values are iterable:

- an array: its elements, read in place, since nothing mutates the array.
- a string: its code points, each a string. A surrogate pair is one element,
  and a lone surrogate is an element of its own. `nanvm` strings are UTF-16
  code units, so this is the one case that computes anything, and it
  computes each element only as it is reached.
- anything else throws: an object, a function, a number, a bigint, a
  boolean, `null`, `undefined`.

It is not `Array::concat`. `concat` keeps a non-array item whole, so it would
make `[...'ab']` into `['ab']`, not `['a', 'b']`, and turn `[...{}]` from a
throw into `[{}]`.

**`own_entries`** is the source side of JavaScript's `CopyDataProperties`,
also restricted to the values a module can build. A module cannot spell a
getter or a symbol key, so the copy reads plain values:

- an object: each key once, holding its last value at its first position.
  Array-index keys come first in ascending order, then every other key in
  insertion order. `__proto__` is an ordinary data key here, as everywhere
  in the EDAG.
- an array: `["0", e0]`, `["1", e1]`, and so on. `length` is not enumerable.
- a string: one entry per UTF-16 code unit, keyed by its index.
- a function, a number, a bigint, a boolean, `null` or `undefined`: none.

The object case is a view `nanvm` already computes but does not share.
`Object` keeps its raw property list, duplicates included, and only
`ToJson::object` in [`vm/any/to_json.rs`](../src/vm/any/to_json.rs) builds
the ordered, deduplicated view, with `array_index_value`. That view becomes
one function that both `own_entries` and `to_json` call, so the order a
spread copies and the order a value is written in cannot drift.

**Both return iterators, not an `Array` or a `Vec`.** No intermediate array is built
for a spread whose elements go straight into another container, and a
string's code points are produced one at a time. Only the `Result` is
eager. Whether a value is iterable is decided before the first element, and
iterating then cannot fail, so the throw happens where `GetIterator` throws.
The array and string cases are two iterator types behind one return type,
an enum of the two or a boxed iterator, whichever the implementation
prefers.

**The asymmetry is part of the design.** `iterable` can fail and returns a
`Result`; `own_entries` cannot fail and returns its iterator. An object's
entries are computed lazily too. Only its deduplication needs to know which
keys come later, so that view decides how much it must read ahead. An executor may
evaluate an object spread whose result goes unused and lose nothing, but not
an array spread.

**Building the result** needs no new representation. An array spread
chains its items, each one `iterable`'s elements or a single value, into
the new array. The array's length limit still applies:
`Array::create` takes the length first. So the builder either counts what it
chains, which walks a string twice, or grows the array from an iterator
whose length it learns at the end. That choice belongs to the
implementation. An object spread appends the entries to the new object's
raw property list in order. A later key then overwrites an earlier one's
value while keeping its position, as JavaScript does, because the
deduplicated view above is what every reader sees.

This is VM groundwork for a node the EDAG already has. Accepting spread
syntax in FunctionalScript source is a separate, language-level decision,
gated by
[DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo).
These operations do not wait on it, and do not decide it.

### Open question: the object side's name and its nullish case

`own_entries` is a working name: "own" rules out inherited properties,
which no FunctionalScript value has, and plain `entries` reads as
`Array.prototype.entries`, which yields numeric indices. `object_entries`
names the function whose semantics this is, `Object.entries`, which agrees
on every value a module can build except `null` and `undefined`: there
`Object.entries` throws, while `{...null}` copies nothing. Two ways to settle
it:

1. `object_entries` is exactly `Object.entries`. It returns a `Result` and
   throws on `null` and `undefined`, and the object-spread builder skips
   those two before calling it.
2. `object_entries` keeps the spread's behaviour, never failing, and the name
   differs from `Object.entries` on those two values.

### Tasks

- [ ] Extract the ordered, deduplicated own-property view from
      `ToJson::object` into one function, and make `to_json` call it.
- [ ] `Any::own_entries` over that view, with the array, string and
      no-property cases.
- [ ] `Any::iterable`: an iterator over an array's elements or a string's
      code points, and a `TypeError` for everything else, raised before any
      element.
- [ ] Rust tests for every case above, including:
      - a surrogate pair and a lone surrogate;
      - an object with a duplicate key and with array-index keys out of order;
      - the four examples in the problem statement.
- [ ] Spell `['...', exp]` in [`fjs/edag/rust`](../../fjs/edag/rust/module.f.mjs)
      through these operations, as an array item and as an object
      property. Add generated fixtures in `nanvm-harness`, checked against
      a JavaScript engine.

### Related

- [`fjs/edag/operations`](../../fjs/edag/operations/module.f.mjs): the JS
  evaluator's `[]` and `{}`, the reference semantics.
- [undefined-property](../../spec/todo/1010-undefined-property.md): the
  overwrite and order constraints any object construction keeps.
- [member-functions](./member-functions.md): the built-ins whose own reads
  of strings and arrays these operations should share code with.
- [`vm/array/concat.rs`](../src/vm/array/concat.rs): what array spread is
  not.
