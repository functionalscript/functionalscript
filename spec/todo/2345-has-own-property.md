# Why Not `in`, And `hasOwn` Instead

**Status:** open. This document started as a proposal to add `in` and was
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
`Object.getOwnPropertyDescriptor(a, c2)?.value`; the sibling instruction
recognizes `Object.hasOwn(obj, prop)` — ES2022's own dedicated own-property
check — directly, as its own call shape, not as a derived comparison against
a descriptor:

```js
const hasB = Object.hasOwn(x, 'b')
```

The three layers this crosses, mirroring `own_property`'s own three (FJS
source, EDAG node, VM command): the FJS pattern above is recognized and
lowered to a new EDAG `Op2` node, `['hasOwn', obj, prop]` — a new `Op2Id`
alongside the existing `'own'` (`fjs/edag/types.ts:163`) rather than a
reuse of it — which in turn lowers to a new VM command, a `HasOwn` sibling
to `own_property`'s `OwnProperty` struct
(`nanvm-lib/src/vm/object/own_property.rs`), returning a `bool` rather than
an `Option<Any<A>>`.

(An earlier version of this section recognized
`Object.getOwnPropertyDescriptor(x, 'b') !== undefined` instead.
`Object.hasOwn` is spec-defined as exactly equivalent to that comparison in
real JS — same chain-bypassing lookup, same answer for every input — but it
says what it means directly, is the ECMAScript-recommended replacement for
the discouraged `obj.hasOwnProperty(prop)` method-call form, and needs
recognizing only a single call rather than a whole comparison expression
built around a descriptor. Changed to this shape as requested in review.)

`own_property` still recognizes `Object.getOwnPropertyDescriptor(a,
c2)?.value` the same way it always has, and still never exposes the full
descriptor object (`value`, `writable`, `get`, `set`, `enumerable`,
`configurable`) as a value in the language — only the one field `?.value`
reads. `hasOwn` doesn't need that same care: `Object.hasOwn`'s return value
*is* the boolean already, so there's nothing to filter out of it.

This needs no new keyword and no new compatibility argument: the source text
is already exactly what it means in any JS engine, the same way `own`'s
source pattern already was. It also needs no closures — unlike a `hasOwn`
*helper function* (`const hasOwn = (obj, prop) => ...`), which would need
`=>`. The tokenizer and the EDAG's `Op2Id` union already recognize `=>`
(`fjs/djs/tokenizer/module.f.mjs`, `fjs/edag/types.ts`), but the parser and
AST do not yet turn it into anything — no arrow-function AST node, no
grammar production consuming it (confirmed by reading `fjs/djs/`). A
pattern-recognized instruction works today; a helper function couldn't.

Because this is scoped to the same receiver `own_property` already
recognizes, it inherits `own`'s existing, already-settled scope decisions
rather than reopening any of them: `Object<A>` receivers only for a first
landing (matching `own`'s own Stage 4 scope), a nullish receiver throws,
a non-object/non-nullish receiver behaves however `own` already defined that
(verified against Node: `Object.getOwnPropertyDescriptor(5, 'x')` is
`undefined`, matching `own`'s design).

**This inherited gap is worse for `hasOwn` than it was for `own`, and needs
an explicit decision, not a silent carry-over.** `Object.hasOwn('hi',
'length')` is `true` in real JS, and so is `Object.hasOwn([1, 2], '0')` for
a string-form index — `own`'s Stage 4 scope already knowingly doesn't
reproduce that for `String`/`Array` receivers, answering `undefined`
instead (its underlying `own_property` primitive requires a `String` key
already in hand and has no `String`/`Array`-receiver case at all — it
doesn't accept a numeric key like `0` for `Array` in the first place, only
a string key, so `Object.hasOwn([1, 2], 0)` is not a meaningful example
here; the string-form `Object.hasOwn([1, 2], '0')` is the comparable case).
For `own`, the gap reads as "no value available," which a caller already
has to treat as an open question. For `hasOwn`, the same gap produces a
*definite, wrong* `false` — `Object.hasOwn('hi', 'length')` recognized
against `own`'s current scope would say "this string has no `length`,"
which is false. A `hasOwn` that ships with `own`'s current `Object<A>`-only
scope needs to either extend to `String`/`Array` receivers for at least the
names they genuinely own (`length`, valid string-form indices) or refuse
those receivers outright (throw, or reject at compile time) rather than
answer a boolean that looks authoritative and isn't.

`obj.hasOwnProperty(prop)` — the method-call form `Object.hasOwn` was
introduced to replace — is a different subject, raised separately in
review: it is not proposed for recognition here, and whether it should ever
be (for compatibility, alongside `Object.hasOwn`, rather than instead of it)
is not a question this document tries to answer.

## Open: what should `hasOwn` answer for `{ a: undefined }`?

Real JS's `Object.hasOwn(x, 'a')` is `true` for `{ a: undefined }` — the
entry is present, merely `undefined`-valued. Whether the recognized
`hasOwn` instruction should agree depends on the same layering question
[undefined-property-vm-layer](./1015-undefined-property-vm-layer.md) asks
directly: does [undefined-property](./1010-undefined-property.md)'s
`{ x: undefined } ≡ {}` equivalence reach the VM's own object
representation (in which case `{ a: undefined }` genuinely has no `a`
entry to find, and `hasOwn` answering `false` is correct, not an
approximation), or is it a restriction on what FS *source* can express,
with the underlying representation — and any VM-level primitive built on
it — left free to agree with real JS (in which case `hasOwn` needs to
answer `true`, matching `Object.hasOwn` exactly, and a language-level
FS-source restriction does the rest of `1010`'s work)?

`own_property` doesn't have to answer this — it already returns `?.value`,
which is `undefined` either way a key is missing or present-but-undefined,
so the two readings are indistinguishable through it. `hasOwn` is a
boolean, so it has to pick one. Until `1015` resolves, this document takes
no position on which; the instruction should not ship until it does.

## Related

- [functionalscript/functionalscript#1888](https://github.com/functionalscript/functionalscript/pull/1888)
  — the discussion that arrived at this.
- [undefined-property](./1010-undefined-property.md) — the pre-existing
  rule that already prohibits `in` by name.
- [undefined-property-vm-layer](./1015-undefined-property-vm-layer.md) —
  the open question `hasOwn`'s answer for `{ a: undefined }` depends on:
  whether `1010`'s equivalence is a language-surface restriction or a
  VM-level one.
- [operators](./2340-operators.md) — the operator table this deliberately
  does *not* add an entry to.
- [property-accessor](./2330-property-accessor.md) — `own_property`'s
  existing pattern-recognition, which `hasOwn` mirrors.
- [design-principles](./design-principles.md) — the no-prototype-chain
  decision `in` couldn't reconcile with JS compatibility, and `hasOwn`
  doesn't need to.
- `nanvm-lib/src/vm/object/own_property.rs` — the existing flat-lookup
  primitive that a `hasOwn` VM instruction would sit beside, not compose
  on: `own`'s recognized pattern reads a descriptor's `?.value` through
  this method, while `hasOwn`'s recognized pattern (`Object.hasOwn`) would
  answer directly, without going through `own_property`'s `Option`-to-value
  shape at all.
