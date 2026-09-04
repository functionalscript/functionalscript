# Does `undefined` Delete a Property? VM vs. Language Layer

**Status:** open, raised in
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

These two ways of reaching (2) are themselves not interchangeable once
duplicate keys are in play. An EDAG object's entries are never deduplicated
— they're applied in written order with the later entry winning
(`fjs/edag/module.f.mjs`'s `'{}'` handler comment) — so for an object
equivalent to `{ a: 1, a: undefined }`, *construction-time* stripping and
*lookup-time* treat-as-absent disagree: stripping the later `(a, undefined)`
entry at construction time leaves the earlier `(a, 1)` entry as the one that
remains, so a lookup for `a` finds `1`. Treating `(key, undefined)` as
absent only at lookup time, with the entry itself still physically last in
the list, instead makes the lookup stop at that last, undefined-valued
entry and report `a` as absent — never falling back to the earlier `1`.
Real JS agrees with neither of these `undefined`-collapsing readings, for
what it's worth: `{ a: 1, a: undefined }.a` is `undefined`, plainly, because
the later assignment really does overwrite the earlier one. Any VM-layer
implementation of (2) has to pick one of the two behaviors above, not treat
them as one design.

These aren't equivalent, and which one is intended changes a real
implementation decision for [has-own-property](./2345-has-own-property.md):
that doc proposes recognizing `Object.hasOwn(obj, prop)` as one VM
instruction. Under (1), the recognized instruction would need to answer
`true` for `{ a: undefined }` to match real JS (the entry is genuinely
there; only FS *source* is restricted from expressing certain ways of
seeing it) — matching `Object.hasOwn`'s real-JS behavior exactly. Under
(2), the entry doesn't exist at the VM layer at all, so the instruction
answering `false` is correct by definition, not a gap to close.

## What today's code does — and what it isn't evidence of

Two pieces of existing code touch this, and neither is the VM of record, so
neither settles the question — but both are worth being precise about
rather than citing loosely as "the reference VM."

[`fjs/edag/amnesia/module.f.mjs`](../../fjs/edag/amnesia/module.f.mjs)'s
`'{}'` handler builds an object literal with `Object.fromEntries(kv)` over
every `key: value` pair as written — it does not filter out entries whose
value is `undefined`. But Amnesia's own README is explicit that
[it is not a VM for FunctionalScript, and nothing that matters should run on
it](../../fjs/edag/amnesia/README.md#why-it-is-not-a-vm): it exists only so
proofs can state what an EDAG node means by evaluating it, it delegates to
its JS host for everything the specification doesn't pin down, and that same
README names NaNVM's Rust bytecode interpreter — not Amnesia — as "the
executor of record." Citing Amnesia's behavior as "what the reference VM
does" overstates it; at most it shows what one JS-hosted proof tool happens
to do, not a VM-layer decision.

NaNVM's own object representation offers a narrower, more relevant data
point: `nanvm-lib/src/vm/object/to_object.rs`'s `ToObject::to_object`, the
primitive that builds an `Object<A>` from a list of properties, also applies
no filter — whatever `(key, value)` pairs it's given, `undefined`-valued
ones included, are what the resulting object holds. That's evidence the flat
representation itself has no built-in stripping behavior at the primitive
level. It is still not proof of intent for `{ x: undefined }` specifically:
there is no EDAG-`{}`-literal-to-NaNVM codegen path yet (object-literal
compilation isn't implemented), so nothing has actually compiled `{ x:
undefined }` down to a `to_object` call and observed the result — this only
shows the primitive doesn't filter when a caller doesn't ask it to, not what
a future object-literal lowering would choose to pass it.

## Open questions

1. If reading (2) is correct, does it mean construction-time stripping or
   lookup-time treat-as-absent? These disagree on duplicate keys (see
   above) — `{ a: 1, a: undefined }` — and neither one matches real JS's own
   `{ a: 1, a: undefined }.a === undefined`, so this isn't a detail that
   falls out of picking (2); it's its own decision.
2. Is today's no-filtering behavior (Amnesia's `'{}'` handler, and
   `to_object`'s lack of a filter at the primitive level) the intended
   VM-layer semantics, or does a future EDAG-`{}`-to-NaNVM lowering need to
   start stripping `undefined`-valued entries to make reading (2) true?
3. If reading (1) is correct — the VM stores the real entry, and only
   FS-source-level restrictions create the equivalence — do `own`/`hasOwn`
   themselves count as "the language" (bound by `1010`'s restriction, so
   they must not expose the entry either) or as general VM primitives
   usable outside the restricted FS-source surface (in which case they
   should answer like real JS, and `hasOwn` needs the dedicated primitive
   after all)?
4. Does the answer differ between `own` (already shipped, returns `?.value`
   — already can't distinguish the two cases, so this is moot for `own`
   specifically) and a prospective `hasOwn` (would be built new, so this
   question is live for it in a way it isn't for `own`)?

## Related

- [undefined-property](./1010-undefined-property.md) — the language-level
  rule this document's layering question is about.
- [has-own-property](./2345-has-own-property.md) — the proposal whose
  `hasOwn` instruction needs this resolved before it can ship.
- [functionalscript/functionalscript#1888](https://github.com/functionalscript/functionalscript/pull/1888)
  — where this was raised.
- `fjs/edag/amnesia/module.f.mjs`'s `'{}'` handler and
  `fjs/edag/amnesia/README.md` — today's proof-tool behavior for
  object-literal construction, and why it isn't VM-layer evidence.
- `nanvm-lib/src/vm/object/to_object.rs` — NaNVM's own flat-object
  construction primitive, which also applies no filter.
