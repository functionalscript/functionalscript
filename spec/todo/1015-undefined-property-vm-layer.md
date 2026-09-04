# Does `undefined` Delete a Property? VM vs. Language Layer

**Status:** open question, raised in
[functionalscript/functionalscript#1888](https://github.com/functionalscript/functionalscript/pull/1888)
while resolving [has-own-property](./2345-has-own-property.md), separated
out at [@sergey-shandar's request](https://github.com/functionalscript/functionalscript/pull/1888#issuecomment-5544729336)
rather than settled inline there.

## Problem

[undefined-property](./1010-undefined-property.md) defines `{ x: undefined }`
as semantically equivalent to `{}` in FunctionalScript, and gives that as the
reason `in` and bare `Object.entries`/`Object.values` are prohibited — those
constructs would let a program observe the one case where a real JS engine
disagrees (`'x' in { x: undefined }` is `true`).

What `1010` doesn't say is *where* that equivalence holds:

1. **Language layer.** The equivalence is a restriction on what FS *source*
   can express — the compiler refuses the specific patterns (`in`, bare
   `Object.entries`/`Object.values`) that could observe the difference, but
   nothing about the underlying VM representation changes: an object literal
   `{ x: undefined }` still stores a real `(x, undefined)` entry, the same
   entry real JS would store. No valid FS program can ever look at it and
   tell, but the entry is there.
2. **VM layer.** The equivalence reaches into the object representation
   itself — either object construction strips `undefined`-valued entries
   outright (`{ x: undefined }` and `{}` build the identical `Object<A>`,
   not just observably-identical-to-FS-programs ones), or every VM-level
   primitive that inspects own properties (`own`, `hasOwn`, and anything
   else in this family) is specifically defined to treat a `(key,
   undefined)` entry as absent, not just every *source-reachable* pattern.

These aren't equivalent, and which one is intended changes a real
implementation decision for [has-own-property](./2345-has-own-property.md):
under (1), `own(x, 'a') !== undefined` for `{ a: undefined }` would
incorrectly answer `false` (real JS's `Object.getOwnPropertyDescriptor`
finds the entry) — `hasOwn` would need the dedicated existence-check
primitive that doc's discussion first proposed, then walked back. Under
(2), collapsing "absent" and "present-but-undefined" is correct by
definition, and `own(...) !== undefined` — what that doc currently says —
needs nothing further.

## What the reference interpreter does today

[`fjs/edag/amnesia/module.f.mjs`](../../fjs/edag/amnesia/module.f.mjs)'s
`'{}'` handler builds an object literal with `Object.fromEntries(kv)` over
every `key: value` pair as written — it does not filter out entries whose
value is `undefined`. An EDAG `{ x: undefined }` node evaluates, today, to a
real JS object with a real `x` property set to `undefined`, indistinguishable
at that layer from what a non-FS JS engine would build. This is evidence for
reading (1) (VM/interpreter representation matches real JS; the restriction
is enforced elsewhere, at the surface the compiler accepts), not proof of
intent — nothing in `1010` or the interpreter comments says this was a
deliberate layering decision rather than simply not having been asked yet.

## Open questions

1. Is the amnesia interpreter's current behavior (preserve the entry) the
   intended VM-layer semantics, or does object construction need to start
   stripping `undefined`-valued entries to make reading (2) true?
2. If reading (1) is correct — the VM stores the real entry, and only
   FS-source-level restrictions create the equivalence — do `own`/`hasOwn`
   themselves count as "the language" (bound by `1010`'s restriction, so
   they must not expose the entry either) or as general VM primitives
   usable outside the restricted FS-source surface (in which case they
   should answer like real JS, and `hasOwn` needs the dedicated primitive
   after all)?
3. Does the answer differ between `own` (already shipped, returns `?.value`
   — already can't distinguish the two cases, so this is moot for `own`
   specifically) and a prospective `hasOwn` (would be built new, so this
   question is live for it in a way it isn't for `own`)?

## Related

- [undefined-property](./1010-undefined-property.md) — the language-level
  rule this document's layering question is about.
- [has-own-property](./2345-has-own-property.md) — the proposal whose
  `own(...) !== undefined` conclusion depends on how this resolves.
- [functionalscript/functionalscript#1888](https://github.com/functionalscript/functionalscript/pull/1888)
  — where this was raised.
- `fjs/edag/amnesia/module.f.mjs`'s `'{}'` handler — today's reference
  behavior for object-literal construction.
