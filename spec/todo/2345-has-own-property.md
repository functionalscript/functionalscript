# Why Not `in`, And `hasOwn` Instead

**Status:** proposal. This document started as a proposal to add `in` and was
rewritten mid-discussion once that turned out to be the wrong move — see
[functionalscript/functionalscript#1888](https://github.com/functionalscript/functionalscript/pull/1888)
for the discussion that got here. It now argues *against* an `in` operator
and *for* a `hasOwn` pattern instead, alongside `own_property` in
[property-accessor](./2330-property-accessor.md).

## Why not `in`

`key in obj` is absent from every layer of the stack — not in
[operators](./2340-operators.md)'s table, not in
[property-accessor](./2330-property-accessor.md), not in the EDAG's `Op2Id`
union (`fjs/edag/types.ts`) — unlike `own`, `<<`, `>>`, `>>>`, which were all
already-spec'd EDAG commands `nanvm-lib` just hadn't implemented yet. Adding
`in` would mean proposing a genuinely new operator, and it runs into a real
problem doing so: [design-principles](./design-principles.md) removes the
prototype chain from FS for simplicity/safety, while
[principle 2](../README.md#principles) requires FS code to "behave on the
FunctionalScript VM the same way as on any other modern JavaScript engine."
Real JS's `in` is *defined* by chain-walking:

```js
'a' in 1          // TypeError: Cannot use 'in' operator to search for 'a' in 1
'a' in null       // TypeError
'a' in {}         // false
'toString' in {}  // true  — inherited from Object.prototype
'length' in []    // true  — own: every array instance has its own `length`,
                  //          not one inherited from Array.prototype
0 in [1, 2, 3]    // true  — own, index 0 exists
```

`own` gets to ignore the chain because it *is* the chain-bypassing operator
by construction — real JS's own `Object.getOwnPropertyDescriptor` already
ignores the chain, so `own`'s semantics and `nanvm-lib`'s flat property list
agree for free. `in` has no equivalent escape: an FS `in` built on the flat
model would answer `false` for `'toString' in {}`, silently diverging from
every other JS engine on the exact input principle 2 exists to protect —
not an accepted corner case, a compatibility violation.

As raised in review: FS also bans every *mutating* method a real prototype
chain would otherwise expose (`[].push(...)` and the like are compile
errors), which removes a good deal of `in`'s remaining practical value —
what's actually useful is knowing whether *this object itself* defines a
key. `own` was already built in that spirit (it bypasses the chain the same
way), but — as the open question below explains — it doesn't actually
answer that question precisely: it returns a value, and a value of
`undefined` is ambiguous between "absent" and "present but `undefined`."
Answering the existence question precisely is exactly what `hasOwn` is for.

## `hasOwn` instead

Rather than inventing operator semantics, reuse the move
[property-accessor](./2330-property-accessor.md) already makes for `own`
itself: recognize a specific, already-meaningful JS expression shape and
lower it to one VM instruction. `own_property` is reached by recognizing
`Object.getOwnPropertyDescriptor(a, c2)?.value`; the sibling shape is the
same call compared against `undefined` instead of read with `?.value`:

```js
const hasB = Object.getOwnPropertyDescriptor(x, 'b') !== undefined
```

Both `own` and `hasOwn` are pattern-recognized around the *bare* call —
neither exposes `Object.getOwnPropertyDescriptor(obj, prop)`'s actual return
value, the full descriptor object (`value`, `writable`, `get`, `set`,
`enumerable`, `configurable`). That is deliberate, not an oversight to close
later: a real descriptor drags in accessors and mutability flags, which is
exactly the complexity FS's object model exists to avoid. `own`/`hasOwn`
only ever recognize the two shapes that consume the descriptor immediately
(`?.value` and `!== undefined`) and never let the descriptor itself become a
value in the language.

This needs no new keyword and no new compatibility argument: the source text
is already exactly what it means in any JS engine, the same way `own`'s
source pattern already was. It also needs no closures — unlike a `hasOwn`
*helper function* (`const hasOwn = (obj, prop) => ...`), which would need
`=>`, and `=>`/closures have no support anywhere in the parser yet (no AST
node, no grammar production — confirmed by reading `fjs/djs/`). A
pattern-recognized instruction works today; a helper function couldn't.

Because this is scoped to the exact same call `own_property` already
recognizes, it inherits `own`'s existing, already-settled scope decisions
rather than reopening any of them: `Object<A>` receivers only for a first
landing (matching `own`'s own Stage 4a scope), a nullish receiver throws,
a non-object/non-nullish receiver behaves however `own` already defined that
(verified against Node: `Object.getOwnPropertyDescriptor(5, 'x')` is
`undefined`, matching `own`'s design).

**This inherited gap is worse for `hasOwn` than it was for `own`, and needs
an explicit decision, not a silent carry-over.** `Object.getOwnPropertyDescriptor('hi',
'length')` and `Object.getOwnPropertyDescriptor([1, 2], 0)` are both real
descriptors in actual JS — `own`'s Stage 4a scope already knowingly doesn't
reproduce that for `String`/`Array` receivers, answering `undefined`
instead. For `own`, that reads as "no value available," which a caller
already has to treat as an open question. For `hasOwn`, the same gap
produces a *definite, wrong* `false` — `Object.getOwnPropertyDescriptor('hi',
'length') !== undefined` would say "this string has no `length`," which is
false. A `hasOwn` that ships with `own`'s current `Object<A>`-only scope
needs to either extend to `String`/`Array` receivers for at least the names
they genuinely own (`length`, valid indices) or refuse those receivers
outright (throw, or reject at compile time) rather than answer a boolean
that looks authoritative and isn't.

## Open question: what backs the existence check

`own(...) !== undefined` is *not* the right implementation, even though it
looks like the obvious one. `Object.getOwnPropertyDescriptor(x, 'a') !==
undefined` is `true` for `{ a: undefined }` in real JS — the key exists with
an `undefined` value — but `nanvm-lib`'s `own_property` already collapses
"absent" and "present-but-undefined" into the same answer, because it
returns `?.value` rather than the descriptor. Composing on top of that
existing return value would get exactly the case a presence check exists to
distinguish wrong.

So `hasOwn` needs a real existence check on `Object<A>`'s flat property list
— does a `(key, _)` pair exist at all — as a new, small `Object<A>`
primitive alongside `nanvm-lib/src/vm/object/own_property.rs`, not a caller
of it. Given that primitive, the pattern-recognition and `Any`-level wiring
follow the exact template `own`/Stage 4a already established.

## Related

- [functionalscript/functionalscript#1888](https://github.com/functionalscript/functionalscript/pull/1888)
  — the discussion that arrived at this.
- [operators](./2340-operators.md) — the operator table this deliberately
  does *not* add an entry to.
- [property-accessor](./2330-property-accessor.md) — `own_property`'s
  existing pattern-recognition, which `hasOwn` mirrors.
- [design-principles](./design-principles.md) — the no-prototype-chain
  decision `in` couldn't reconcile with JS compatibility, and `hasOwn`
  doesn't need to.
- `nanvm-lib/src/vm/object/own_property.rs` — the existing flat-lookup
  primitive; `hasOwn`'s existence check is a sibling to this, not a caller.
