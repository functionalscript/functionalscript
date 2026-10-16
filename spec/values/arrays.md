# Arrays

**Status:** implemented

```js
export default [
    "hello",
    42,
    [true, null],
];
```

An array may be empty, may hold any value including another array or an
object, and may end with a **trailing comma**. Two adjacent commas are not an
elision: an array has no holes.

See
<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Trailing_commas>.

## Spread

An item may be a **spread**, `...` and any value, at any position and any
number of times:

```js
const a = [1, 2];
export default [[0, ...a, 3], [...a, ...a], [...'a😀']];
// [[0, 1, 2, 3], [1, 2, 1, 2], ['a', '😀']]
```

The operand is evaluated in its place among the items, left to right, and
then iterated, each value it yields becoming one item, as JavaScript's
`SpreadElement` does. An array yields its elements in index order, and a
string its code points, each a string of its own: `[...'😀']` is one item
of two code units. Every other value — `null`, `undefined`, a boolean, a
number, a `bigint`, an object, a function — is not iterable, and the spread
fails, as JavaScript's `GetIterator` throws its `TypeError` (`a spread of a
value that is not iterable`): a FunctionalScript object cannot define
`Symbol.iterator`, so no object is iterable here, and none is in JavaScript
either. A call's arguments take a spread the same way
([functions](../functions/README.md)).

The value outputs write the array the spread made, and the graph outputs
the spread itself: `.js` and `.f.js` write it back, `[0, ...a]`, the EDAG
keeps its `['...', exp]` item, and `.rs` prints it through `nanvm-lib`'s
`get_iterator`. A constant spread is not folded, so `[...[1, 2]]` is a
different graph from `[1, 2]`, as `1 + 1` is from `2`. A spread puts its
operand's elements in the array and not the operand, so it shares what an
element shares: `const a = [{}]; export default [[...a], a];` holds the
object once, a `const` in DataJS and written where each reference reaches
it in JSON ([Output](../command-line/output.md)), where `const a = [1]` in its place shares
nothing. An object literal takes a spread too, with a different reading
([objects](objects.md)).

## Examples

No programs yet: this page's accepted and refused examples are a follow-up.

## Reference

- ECMA-262: [Array initializer](https://tc39.es/ecma262/#sec-array-initializer)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array>
