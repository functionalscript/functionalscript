# Why Not `in`, And `hasOwn` Instead

**Status:** proposal. This document started as a proposal to add `in` and was
rewritten mid-discussion once that turned out to be the wrong move — see
[functionalscript/functionalscript#1888](https://github.com/functionalscript/functionalscript/pull/1888)
for the discussion that got here. It now argues *against* an `in` operator
and *for* a `hasOwn` pattern instead, alongside `own_property` in
[property-accessor](./2330-property-accessor.md).

## Why not `in`

There's already a direct answer to this, and it predates this document:
[undefined-property](./1010-undefined-property.md) explicitly prohibits
`in`, by name, because `'x' in { x: undefined }` is `true` in real JS while
FS defines `{ x: undefined }` as semantically equivalent to `{}` — a
property with an `undefined` value is not a property FS considers to exist.
That single divergence is reason enough on its own; everything below is a
second, independent reason that would still apply even without `1010`.

`key in obj` is absent from every layer of the stack besides that — not in
[operators](./2340-operators.md)'s table, not in
[property-accessor](./2330-property-accessor.md), not in the EDAG's `Op2Id`
union (`fjs/edag/types.ts`) — unlike `own`, `<<`, `>>`, `>>>`, each of which
was already a spec'd EDAG command before `nanvm-lib` implemented it (all
four now ship). Adding `in` would mean proposing a genuinely new operator
with no prior EDAG entry to catch up to, and it runs into a real problem
doing so: [design-principles](./design-principles.md) removes the
prototype chain from FS for simplicity/safety, while
[principle 2](../README.md#principles) requires FS code to "behave on the
FunctionalScript VM the same way as on any other modern JavaScript engine."
Real JS's `in` is *defined* by chain-walking:

```js
'a' in 1          // throws TypeError (message text is engine-specific)
'a' in null       // throws TypeError
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
way); `hasOwn` gives that same question a boolean answer instead of a value,
which is what a presence check needs to compose with, rather than a value
callers have to compare against `undefined` themselves.

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

## Resolved: `own(...) !== undefined` is correct, not an approximation

An earlier version of this section argued `hasOwn` needs its own
existence-check primitive, because `own(...) !== undefined` collapses
`{ a: undefined }` (present, `'a' in { a: undefined }` is `true` in real JS)
with a genuinely absent key. That argument implicitly assumed `hasOwn` has
to reproduce real JS's answer for that case. It doesn't —
[undefined-property](./1010-undefined-property.md) already settles this,
for the whole language, the other way: `{ x: undefined }` is defined to be
*semantically equivalent to* `{}` in FS, specifically **because** the two
diverge under `Object.entries`/`Object.values`/`in` in real JS, and that
divergence is exactly the class of bug `1010` exists to rule out at the
language level. It even names `in` by example: `'x' in { x: undefined }`
being `true` despite the property being "non-existent under the FS model"
is the *reason* `1010` gives for prohibiting `in`, not an incidental detail.

So `hasOwn` reporting `{ a: undefined }` as absent isn't a gap to close —
it's the one answer consistent with `1010`, and `own_property`'s existing
`?.value` collapse (which already can't tell "absent" from
"present-but-undefined," because both read as no value) is already exactly
that answer. `own(...) !== undefined` is correct as written. `hasOwn` needs
no new `Object<A>` primitive: it composes directly on `own_property`, the
same value `own` already returns, and inherits every scope decision `own`'s
Stage 4a already made (`Object<A>` receivers only, nullish throws, the
`String`/`Array` gap flagged above) with nothing further to resolve here.

## Related

- [functionalscript/functionalscript#1888](https://github.com/functionalscript/functionalscript/pull/1888)
  — the discussion that arrived at this.
- [undefined-property](./1010-undefined-property.md) — the pre-existing
  rule that already prohibits `in` by name, and the reason `hasOwn` needs
  no new existence-check primitive beyond `own_property`.
- [operators](./2340-operators.md) — the operator table this deliberately
  does *not* add an entry to.
- [property-accessor](./2330-property-accessor.md) — `own_property`'s
  existing pattern-recognition, which `hasOwn` mirrors.
- [design-principles](./design-principles.md) — the no-prototype-chain
  decision `in` couldn't reconcile with JS compatibility, and `hasOwn`
  doesn't need to.
- `nanvm-lib/src/vm/object/own_property.rs` — the existing flat-lookup
  primitive `hasOwn` composes on directly.
