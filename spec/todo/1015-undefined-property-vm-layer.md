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
duplicate keys are in play, and the two questions they answer — what a
plain read gets, versus what an existence check like `hasOwn` reports —
have to be kept separate to see how. An EDAG object's entries are never
deduplicated — they're applied in written order with the later entry
winning (`fjs/edag/module.f.mjs`'s `'{}'` handler comment) — so take an
object equivalent to `{ a: 1, a: undefined }`. Real JS's own answer for
both questions is settled and not in dispute: `.a` reads `undefined` (the
later assignment overwrote the earlier one, plainly), and
`Object.hasOwn(obj, 'a')` is `true` (the property is there, merely
`undefined`-valued).

*Construction-time* stripping (drop `undefined`-valued entries when the
object is built) diverges from real JS on the **value** question: with the
trailing `(a, undefined)` entry gone, the earlier `(a, 1)` entry is what's
left, so `.a` — and `own_property`'s `?.value` — reads `1`, not real JS's
`undefined`. It happens to *agree* with real JS on the **existence**
question, though for an unrelated reason: `hasOwn(obj, 'a')` is `true`
either way, but under this reading that's because a genuine `(a, 1)` entry
survived, not because of anything specific to the `undefined` duplicate.

*Lookup-time* treat-as-absent (leave every entry stored as written; only a
boolean existence primitive treats a `(key, undefined)` entry specially)
does the opposite: value reads are unaffected by it, so `.a` still finds
the real last entry and reads `undefined`, matching real JS. But
`hasOwn(obj, 'a')` — the thing this reading actually changes — reports
`false` (stops at the last, `undefined`-valued entry and calls that
"absent," never falling back to the earlier `1`), diverging from real JS's
`true`.

So neither reading reproduces real JS on *both* questions at once for this
case — each matches on one and diverges on the other, and which one
diverges depends on which question is asked. Any VM-layer implementation of
(2) has to pick a behavior for the duplicate-key case explicitly, not treat
it as a detail that falls out of choosing (2) over (1).

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

Three pieces of existing code touch this. None is the VM of record and
none settles the question, but the strongest of the three is real,
running codegen — worth being precise about rather than citing any of
them loosely as "the reference VM."

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

`nanvm-lib/src/vm/object/to_object.rs`'s `ToObject::to_object`, the
primitive that builds an `Object<A>` from a list of properties, also applies
no filter — whatever `(key, value)` pairs it's given, `undefined`-valued
ones included, are what the resulting object holds. That's evidence the flat
representation itself has no built-in stripping behavior at the primitive
level, but taken alone it isn't proof of intent for `{ x: undefined }`
specifically: nothing here says whether a caller building an object from an
EDAG node would filter before calling it.

The third piece answers that: [`fjs/nanvm/rust/module.f.mjs`](../../fjs/nanvm/rust/module.f.mjs)
is real, tested EDAG-to-Rust codegen — its `expExpr`'s `'{}'` branch lowers
an EDAG object-literal node directly to a `to_object()` call, printing every
`key: value` entry via `propertyExpr` with no filter on the value, `undefined`
included. This *is* a real EDAG-`{}`-to-NaNVM lowering path, contrary to what
an earlier version of this document claimed — but it's worth being precise
about its scope: this printer's output is `nanvm-lib/tests/test/generated.rs`,
generated from the shared hand-authored operator-test corpus
(`fjs/nanvm/module.f.mjs`), not from compiling parsed DJS source — there is
still no DJS-source-`{}`-literal-to-EDAG-to-NaNVM path exercising this for a
program a person actually wrote. What it does prove: today's only real,
compiled-and-run object-literal lowering to NaNVM preserves an
`undefined`-valued entry rather than stripping it — the strongest evidence
so far for reading (1), short of an explicit design decision either way.

## Open questions

1. If reading (2) is correct, does it mean construction-time stripping or
   lookup-time treat-as-absent? These disagree on duplicate keys (see
   above) — `{ a: 1, a: undefined }` — with each matching real JS on one of
   the value/existence questions and diverging on the other, so this isn't
   a detail that falls out of picking (2); it's its own decision.
2. Is today's no-filtering behavior (Amnesia's `'{}'` handler, `to_object`'s
   lack of a filter at the primitive level, and `fjs/nanvm/rust/module.f.mjs`'s
   real object-literal-to-`to_object()` lowering) the intended VM-layer
   semantics, or does object-literal codegen need to start stripping
   `undefined`-valued entries — including in this existing printer — to
   make reading (2) true?
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
- `fjs/nanvm/rust/module.f.mjs` — the real, tested EDAG-`{}`-to-Rust
  printer whose object-literal branch is today's strongest (though still
  not dispositive) evidence for reading (1).
