# The `in` Operator

**Status:** proposal — not yet in [operators](./2340-operators.md)'s table, not yet an
EDAG `Op2Id`, not yet implemented anywhere.

## Problem

`key in obj` is missing from every layer of the stack: it is absent from
[operators](./2340-operators.md)'s priority table, from
[property-accessor](./2330-property-accessor.md) (which covers `own_property`,
`instance_property`, `at`, and method calls but never `in`), and from the
EDAG's own `Op2Id` union (`fjs/edag/types.ts`) — unlike `own`, `<<`, `>>`,
`>>>`, and the rest of the operators this rollout has been filling in one by
one, which were all already-spec'd EDAG commands `nanvm-lib` hadn't
implemented yet. Adding `in` means proposing a new operator from scratch, at
every layer, not catching one layer up to another.

That is worth doing carefully, because `in` runs straight into the one
design tension this codebase has already named and lived with:
[design-principles](./design-principles.md) removes the prototype chain from
FS "in accordance with prioritization of simplicity and safety," while
[the same document's principle 2](../README.md#principles) requires that
"the code that passed validation/compilation should behave on the
FunctionalScript VM the same way as on any other modern JavaScript engine."
`in` is a real JS operator whose entire job is prototype-chain-aware
existence testing — `'toString' in {}` is `true` in JS specifically because
`{}` inherits from `Object.prototype`. An `in` that only tests
`nanvm-lib`'s flat own-property list would answer `false` for that case,
which principle 2 forbids outright: this is not a corner case to accept and
document, it is exactly the kind of divergence the spec says must not ship.

`own` avoids this tension because it *is* the chain-bypassing operator by
definition — real JS's own `Object.getOwnPropertyDescriptor` already ignores
the chain, so `own`'s semantics and `nanvm-lib`'s flat property list agree
by construction. `in` has no such escape: real JS's `in` is defined in terms
of the chain, so an FS `in` has to reproduce what the chain would have
answered, using only the flat model FS actually has.

## Real JS semantics (reference)

Verified against Node:

```js
'a' in 1          // TypeError: Cannot use 'in' operator to search for 'a' in 1
'a' in 'str'      // TypeError — same, strings are primitives too
'a' in true       // TypeError
'a' in 5n         // TypeError
'a' in null       // TypeError
'a' in undefined  // TypeError
'a' in {}         // false
'toString' in {}  // true  — inherited from Object.prototype
'length' in []    // true  — inherited from Array.prototype
0 in [1, 2, 3]    // true  — own, index 0 exists
5 in [1, 2, 3]    // false — own, index 5 does not exist
'call' in (()=>{}) // true — inherited from Function.prototype
```

Two things every non-object receiver shares: *every* primitive throws, not
just nullish (`own`'s design deliberately differs here — a non-object,
non-nullish receiver for `own` answers `undefined` rather than throwing,
which is a scope simplification `own`'s own doc comment already owns; `in`
does not get to make the same simplification, since real JS's rule is not
"throws only when nullish," it is "throws whenever the receiver is not an
object" — a materially different rule this operator would have to get
right, not approximate). And the key coercion question `own` already
settled — the key must already evaluate to a `String`, not be coerced via
`ToPropertyKey` — applies here too, for the same reason: the EDAG's
shape-only schema cannot express "this operand evaluates to a string."

## Proposal shape

Reuse the pattern [property-accessor](./2330-property-accessor.md) already
established for `instance_property`: a small, fixed table of "well-known"
inherited names gets special-cased, and everything else is a flat own-lookup.
Concretely, `in`'s node would lower to:

```
in(receiver, key) =
    if receiver is nullish or a Number/String/Boolean/BigInt: throw TypeError
    else if receiver is an Object:
        own(receiver, key) !== undefined  // wrong for {a: undefined} — see below
        or key is a well-known Object.prototype name
    else if receiver is an Array:
        key is a valid own index, or key is "length",
        or key is a well-known Array.prototype name
    else if receiver is a Function:
        key is a well-known Function.prototype name
```

The well-known name sets are exactly the ones
[property-accessor](./2330-property-accessor.md) already enumerates for
`instance_property` (Object/Array/Function instance properties and the
side-effect-free instance methods) — this operator does not need to invent a
second list, it needs to reuse that one.

## Open questions

1. **`own(...) !== undefined` is the wrong test.** `'a' in { a: undefined }`
   is `true` in JS — the key exists with an `undefined` value — but `own`
   collapses "absent" and "present-but-undefined" into the same answer,
   because it returns `?.value` rather than the descriptor. `in` needs a
   real existence check on `Object<A>`'s flat property list (does a
   `(key, _)` pair exist at all), not a reuse of `own_property`'s existing
   return value. This is a new `Object<A>` primitive, not a call to the one
   `own_property.rs` already has.
2. **How exhaustive does the well-known-name table need to be, and does it
   need to match `2330`'s table exactly, or does `in` have its own
   (possibly larger) set?** `2330`'s table is scoped to what
   `instance_property`/method-call syntax needs to resolve; `in` is a
   pure existence *test*, so it plausibly needs the same names but not the
   same restrictions (`2330` prohibits `__proto__`/`constructor` outright as
   compile errors when *read*; does `'constructor' in obj` also have to be a
   compile error, or is testing existence safe where reading the value is
   not?).
3. **Does a computed (non-literal) key make the well-known-name table
   unreachable at compile time, the same way `2330`'s `own_property`
   fallback exists for exactly that case?** If so, `in` over a computed key
   against an `Object` receiver would need to check the well-known set *at
   run time* too, not just resolve it during compilation — a different shape
   from `2330`'s `instance_property`, which only special-cases
   compile-time-known names and otherwise falls back to `own_property`
   unconditionally (no run-time well-known-name check, because `own_property`
   is already correct for every name in that fallback — `in` does not have
   an equivalent unconditionally-correct fallback to fall back to).
4. **Error message.** Real JS's message interpolates both the key and a
   string form of the receiver (`Cannot use 'in' operator to search for 'a'
   in 1`). Every existing `nanvm-lib` error message is a fixed string with no
   interpolation (see `own`'s `CANNOT_CONVERT_NULLISH_TO_OBJECT`,
   `<<`'s `TOO_LARGE`) — the corpus only ever asserts `expected: throws`, not
   exact text, so exact fidelity has never been required. Does `in` keep
   that convention (a fixed, generic message), or is this the operator where
   dynamic message construction gets introduced?
5. **Scope for a first landing.** Given (1)–(3), a first version could
   plausibly ship `Object<A>` receivers only (matching `own`'s Stage 4a
   scope decision) and defer the well-known-name tables for `Array`/
   `Function` receivers to a later stage, the same way `own_property`
   deferred `Array<A>` indexing. That would still need the real
   existence-check primitive from (1), just not the well-known-name work
   from (2)–(3).

## Related

- [operators](./2340-operators.md) — the source-language operator table `in`
  is missing from.
- [property-accessor](./2330-property-accessor.md) — `own_property`,
  `instance_property`, and the well-known-name tables this proposal reuses.
- [design-principles](./design-principles.md) — the no-prototype-chain
  decision this operator has to reconcile with JS compatibility.
- `fjs/edag/types.ts`'s `Op2Id` — where `in` would be added once this
  proposal is settled.
- `nanvm-lib/src/vm/object/own_property.rs` — the existing flat-lookup
  primitive; `in`'s existence check (open question 1) is a sibling to this,
  not a caller of it.
