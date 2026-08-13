# Structurally same

## Why this is its own module

`structurallySame` is the comparison behind `assertStructurallySame` in
[`fjs/asserts`](../../../asserts/module.f.mjs), and it is also an ordinary
object helper that belongs on [`fjs/types/object`](../module.f.mjs). Those two
homes cannot both be the implementation: the object module imports
`types/nullable`, which imports `fjs/asserts`, so an assertion module importing
the object module would close the runtime cycle
`asserts -> object -> nullable -> asserts`.

So the implementation lives here, in a leaf that imports **nothing**, and the
two consumers reach it from opposite directions — `fjs/asserts` imports it
directly, and `fjs/types/object` re-exports it as part of its public API. Adding
any import to this module re-opens the cycle; keep it a leaf.

## What it compares, and what it does not

The contract is FunctionalScript data — primitives, arrays, and record-like
objects:

- `Object.is` decides first, so `NaN` is the same as `NaN`, `0` and `-0` differ,
  and a value is trivially the same as itself.
- Arrays match arrays of equal length, elementwise. An array never matches a
  non-array.
- Other objects match on their own enumerable string properties as a *set* —
  order is not part of the structure — with every value compared recursively.
  A property whose value is `undefined` is a property, so `{ a: undefined }` and
  `{}` differ.

The signature takes `unknown` because assertion and parsing boundaries have
nothing narrower to offer, but a wide input type is not a promise of wide
semantics. A date, map, set, or typed array is compared **only** by its own
enumerable string properties, which for most of them is no properties at all —
two different `Date`s read as the same. Prototypes, property descriptors,
symbol keys, and getters are all invisible here. A caller needing any of those
needs a different comparison, not a flag on this one.

There is no cycle detection: a self-referential value recurses until the stack
runs out. FunctionalScript data is acyclic, so a seen-set would tax every real
comparison to catch a case that cannot occur.

Array comparison likewise assumes **dense** arrays. `Array.prototype.every`
skips a sparse array's holes, so a hole-bearing first operand would compare
vacuously equal in one direction and not the other. That asymmetry is
unreachable rather than handled: FunctionalScript has no way to build a sparse
array — `new Array(n)` is not part of the language — so the input cannot occur,
and spreading every array into a dense copy to defend against it would cost an
allocation per comparison for a value that cannot exist. Callers reaching this
from plain JavaScript with a hand-built sparse array are outside the contract,
like the host objects above.

## Why proofs should prefer it to `JSON.stringify`

Proofs reached for `assertEq(JSON.stringify(a), JSON.stringify(b))` because no
structural comparison existed. Serialization answers a different question and
drags in semantics the proof did not ask for: property order becomes
observable, `undefined`-valued properties vanish, `NaN` and the infinities
collapse to `null`, `-0` becomes `0`, `bigint` throws, and both sides allocate
strings only to be thrown away.

Keep a string comparison where the serialized text *is* the contract — a
serializer's own proofs, or an API that returns text. Everywhere else, state the
expected value directly and compare it with `assertStructurallySame`.
