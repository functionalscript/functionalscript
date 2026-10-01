## Spread operations on `Any`

**Priority:** P3
**Status:** open

### Problem

The EDAG already has a spread entry, `['...', exp]`, valid only inside an
array's items or an object's properties
([`fjs/edag/README.md`](../../fjs/edag/README.md), `Items` and `Properties` in
[`fjs/edag/types.ts`](../../fjs/edag/types.ts)). The JS evaluator in
[`fjs/edag/operations`](../../fjs/edag/operations/module.f.mjs) runs both
entries with JavaScript's semantics. The Rust writer,
[`fjs/edag/rust`](../../fjs/edag/rust/module.f.mjs), refuses both: `Any` has
no operation for either.

The type of a spread's operand is unknown when the graph is built, so each
spread needs one operation on `Any` that dispatches on the value it gets. The
container decides which one: inside `[]` the operand is iterated, inside
`{}` its own properties are copied. The two are different readings of a
value, and they differ even on strings:

```js
[...'😀']   // ['😀']: one code point
{...'😀'}   // { 0: '\ud83d', 1: '\ude00' }: two code units
[...{}]     // throws: an object is not iterable
{...1}      // {}: a number has no own properties
```

### Proposal

Two methods on `Any`, each named for the rule it implements:

```rust
/// ECMAScript's `GetIterator(self, sync)`: an iterator over an array's
/// elements or a string's code points. Any other value is not iterable,
/// and the `TypeError` is raised here, before any element.
fn get_iterator(self) -> Result<IteratorRecord<A>, Any<A>>

/// What `{...self}` copies — the source side of ECMAScript's
/// `CopyDataProperties`: the own enumerable string-keyed properties of
/// `self`, in `[[OwnPropertyKeys]]` order. A string has one per UTF-16
/// code unit; a number, bigint, boolean, function, `null` and `undefined`
/// have none; and nothing throws.
fn object_spread(self) -> ObjectSpread<A>
```

The names are not symmetric because the semantics are not:

- **`get_iterator` is a general protocol, not a spread rule.** Array spread,
  call spread and array destructuring, `const [a, b] = x`
  ([destructuring](../../spec/todo/2450-destructuring.md)), all start with
  `GetIterator`, so the operation takes the spec's name.
- **`object_spread` is spread-specific.** `Object.entries` throws on `null`
  and `undefined`, where `{...null}` is `{}`. Object rest destructuring,
  `const {...r} = x`, runs `RequireObjectCoercible` first and throws on
  them too. Only spread copies nothing from a nullish value.

**`get_iterator`** is JavaScript iteration restricted to the values a module
can build. FunctionalScript has no `Map`, `Set` or generators, so only two
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

**`object_spread`** reads plain values, since a module cannot spell a getter
or a symbol key:

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
one function that both `object_spread` and `to_json` call, so the order a
spread copies and the order a value is written in cannot drift.

**A call spread is an array spread.** A call's arguments are the item list
an array literal holds, and `ArgumentListEvaluation` runs the same
`GetIterator` an array literal does. So `f(a, ...x, b)` is
`['()', f, [a, ['...', x], b]]`, the array `[a, ...x, b]` passed as the
arguments, and `f(...'ab')` passes `'a'` and `'b'`. Forwarding a rest
parameter, `(...r) => f(...r)`, is a spread like any other,
`['()', f, [['...', ['rest']]]]`: every callee builds its own rest array from
the arguments in both executors, so an executor may skip the copy where the
operand is an array by construction, and no identity leaks.
[`fjs/edag/README.md`](../../fjs/edag/README.md) and the
[stage 1 discussion](../../todo/edag-stage1-discussion.md) record the same
rule.

**The asymmetry is part of the design.** `get_iterator` can fail and
returns a `Result`; `object_spread` cannot fail. An executor may evaluate an
object spread whose result goes unused and lose nothing, but not an array
spread.

**Building the result** needs no new representation. An array spread
chains its items, each one an iterator's elements or a single value, into
the new array, and an object spread appends its entries to the new object's
raw property list in order. A later key then overwrites an earlier one's
value while keeping its position, as JavaScript does, because the
deduplicated view above is what every reader sees.

This is VM groundwork for a node the EDAG already has. Accepting spread
syntax in FunctionalScript source is a separate, language-level decision,
gated by
[DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo).
These operations do not wait on it, and do not decide it.

### The iterator type

What `get_iterator` returns, and what `object_spread` returns beside it:

- **A Rust type, never a VM value.** A FunctionalScript module cannot hold
  an iterator: `values()`, `entries()` and `keys()` are prohibited calls, and
  `Symbol.iterator` cannot be spelled. So an iterator is not an `Any`, has
  no `IVm` representation and never reaches a program. It exists only
  between `get_iterator` and the container being built, so nothing can
  observe its state or advance it twice.
- **A concrete, named type**, not `impl Iterator`. Generated Rust from
  [`fjs/edag/rust`](../../fjs/edag/rust/module.f.mjs) names it, and a named
  type keeps the API stable. It is `IteratorRecord<A>`, after the spec's
  Iterator Record that `GetIterator` returns, which also keeps it apart from
  Rust's `Iterator` trait. The spec's record also holds a `next` method and
  a `[[Done]]` flag; this one needs neither, and the name is kept anyway. It implements
  `Iterator<Item = Any<A>>` and is fused.
- **An enum of the two iterable kinds**, each owning a clone of its value,
  which is a reference count, and a position:

  ```rust
  pub enum IteratorRecord<A: IVm> {
      Array { array: Array<A>, next: u32 },
      String { string: String<A>, next: u32 }, // a code-unit index
  }
  ```

  It is generic over `A` through `Array` and `String`'s own index reads, so
  `IVm` gains nothing. An owned value, not a borrow of `self`, lets the
  iterator outlive the expression that produced it.
- **Items are values, not `Result`s.** Iterating an array or a string
  cannot fail, so a failure can only come from `get_iterator` itself. A
  future iterable whose stepping can fail would change this, and is out of
  scope: FunctionalScript has no such value.
- **`size_hint` is exact for an array** and bounds a string, at least half
  its remaining code units, rounded up, and at most all of them. The array
  builder may reject early only when the lower bounds already exceed the
  length limit, and may use the upper bounds to size its allocation. A
  string's upper bound counts code units, so it can exceed the limit while
  the code points it yields do not: that is no `RangeError`. Acceptance
  depends on the count actually produced.
- **`ObjectSpread<A>`** is the object side's counterpart, with
  `Item = (String<A>, Any<A>)`. Its object variant needs the deduplicated
  key order before its first entry, so it computes that order when it is
  created. Its array and string variants stay index walks, and its empty
  variant covers everything else.

**Each code point is a new `String<A>`**, as JavaScript makes it. Sharing
the parent's buffer is an optimization, and
[string slices](./string-slices.md) investigates it for every operation that
produces part of a string, not for this one alone.

### Tasks

- [ ] Extract the ordered, deduplicated own-property view from
      `ToJson::object` into one function, and make `to_json` call it.
- [ ] `IteratorRecord<A>` and `Any::get_iterator`: an array's elements and a
      string's code points, and a `TypeError` for everything else, raised
      before any element.
- [ ] `ObjectSpread<A>` and `Any::object_spread` over that view, with the
      array, string and empty cases.
- [ ] Rust tests for every case above, including:
      - a surrogate pair and a lone surrogate;
      - an object with a duplicate key and with array-index keys out of order;
      - the four examples in the problem statement.
- [ ] Spell `['...', exp]` in [`fjs/edag/rust`](../../fjs/edag/rust/module.f.mjs)
      through these operations, as an array item, a call's argument and an
      object property. Add generated fixtures in `nanvm-harness`, checked
      against a JavaScript engine.

### Related

- [`fjs/edag/operations`](../../fjs/edag/operations/module.f.mjs): the JS
  evaluator's `[]` and `{}`, the reference semantics.
- [undefined-property](../../spec/todo/1010-undefined-property.md): the
  overwrite and order constraints any object construction keeps.
- [member-functions](./member-functions.md): the built-ins whose own reads
  of strings and arrays these operations should share code with.
- [`vm/array/concat.rs`](../src/vm/array/concat.rs): what array spread is
  not.
