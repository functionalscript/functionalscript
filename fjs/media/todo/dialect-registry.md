## dialect-registry. `media` `detect` recognizes only `vnd.fjs.revision`

**Priority:** P2
**Status:** open

### Problem

[`fjs/media/module.f.ts`](../module.f.ts) layers dialect-tagged JSON recognition
on top of [`fjs/media/type`](../type/module.f.ts)'s byte-signature classifier:
when a whole buffered `Vec` is valid UTF-8 text, `detect` parses it as JSON and
validates it against a known dialect's rtti schema, reporting that dialect's
derived media type on a match.

"A known dialect" is exactly one, fixed at import time:

```ts
import { decodeText as decodeRevisionText, mediaType as revisionMediaType } from './revision/module.f.ts'
// …
const [tag] = decodeRevisionText(text)
return tag === 'ok' ? { ...base, mime_type: revisionMediaType } : base
```

`vnd.fjs.revision` is therefore the only dialect `detect` can ever recognize,
and there is no way for any other module — in this repo or downstream — to
contribute one. The module's own docstring already anticipates this: it says the
validation is against "a known dialect's rtti schema (currently just
`vnd.fjs.revision`)".

The naming convention makes the gap concrete.
[`fjs/media/revision`'s README](../revision/README.md) establishes the pattern
for new formats — JSON plus a `dialect` tag, named `vnd.fjs.<name>`, yielding
`application/vnd.fjs.<name>+json` — and any format following it is structurally
identical to `revision` from `detect`'s point of view. But a blob in such a
format classifies as `text/plain`, because `detect` cannot be told about it. The
convention invites new dialects; the detector recognizes exactly one.

This is not urgent for a consumer that knows what it is validating — such a
caller invokes its own dialect's `validate`/`decodeText` directly and needs
nothing from `detect`. It bites when classifying a blob of *unknown*
provenance, which is what `detect` exists for.

### Proposal

Make the set of dialects a parameter rather than an import, and **limit what an
entry can say to an rtti schema plus a typed refinement predicate** — no
decoder, no media type, no separate dialect name:

```ts
/** A schema that names its own dialect: `StringMap<'dialect', string>`. */
export type DialectType = StringMap<'dialect', string>

/** The registry entry: a dialect name and a predicate over a parsed value. */
export type DialectEntry<S extends string> = {
    readonly dialect: S
    readonly match: (_: Unknown) => boolean
}

/** Registers a dialect for detection: its schema, plus whatever rtti can't say. */
export const dialectEntry = <T extends DialectType>(
    type: T,
    extraValidate: (_: Ts<T>) => boolean = () => true,
): DialectEntry<T['dialect']> => {
    const v = validate(type)
    return {
        dialect: type.dialect,
        match: u => {
            const [tag, value] = v(u)
            return tag === 'ok' && extraValidate(value)
        },
    }
}
```

A dialect schema is already a struct whose `dialect` member is a string const —
that is how `revisionSchema` is written, and it is what makes the schema
self-discriminating. So the dialect name is *in* the schema, and a separate
`dialect` field alongside it would be a second copy that can disagree with the
first. `detect` reads `type.dialect` and derives the media type from it.

The constraint is `StringMap<'dialect', string>` — the repo's spelling of
`{ readonly dialect: string }` — and nothing more. Three other spellings were
tried against the real `revisionSchema`, `Ts`, and `validate` with
`tsc --strict`, and each fails:

- `Struct & { readonly dialect: string }` — the intersection AGENTS.md rules
  out. (Its usual remedy, embedding the record as a named field, cannot apply
  here either: an entry's schema *is* an rtti `Type`, so
  `{ struct: Struct, dialect: string }` yields something `validate` cannot
  consume.)
- An inline `{ readonly [k: string]: Type | undefined, readonly dialect:
  string }` — the inline index signature reserved for mutually-recursive types.
- `<T extends Struct>` with the member gated by conditionals
  (`type: DialectSchema<T>`, returning `DialectEntry<DialectName<T>>`). This
  one type-checks at the *call site* but not in the body: `type.dialect` stays
  `Type` (including `undefined`) rather than `DialectName<T>` (TS2322), and
  `validate(type)` yields `Ts<DialectSchema<T>>`, which is not `Ts<T>` and so
  cannot feed `extraValidate` (TS2345). Adding `Struct` to the constraint
  alongside `StringMap<'dialect', string>` instead blows up with TS2589,
  "type instantiation is excessively deep".

The version above compiles end to end, body included, with no `as`. Checked,
not assumed: `dialectEntry(revisionSchema, r => r.generation >= 0)` infers `r`
as the decoded `Revision` with no annotation; the entry's `dialect` is the
literal `'vnd.fjs.revision'`, so
`revisionDialect: DialectEntry<typeof dialect>` type-checks and assigning it to
a different literal errors; a schema with no `dialect` member is rejected at
the call site; and a thunk-form `dialect` is rejected too, since a function is
not a `string` — which is what makes the direct-const rule below
compile-enforced rather than merely stated.

What this constraint does *not* say is that the schema's other members are rtti
`Type`s — `Struct` cannot be added back, per TS2589 above. In practice the gap
is small: `Const` admits every primitive, array, and object literal, so almost
any member is a valid schema; a genuinely malformed one (a function that is not
a thunk) is caught by `validate`, not by registration.

`extraValidate` closes the gap rtti leaves. Structural validation cannot say
"this string is cbase32-decodable" or "this number is a non-negative safe
integer", and a dialect that needs those has nowhere to put them under a
schema-only entry. Here it does: the predicate runs on the value *after*
structural validation, so its parameter is `Ts<T>` — the dialect's own decoded
type, not `Unknown`. `revision` registers `revisionSchema` together with
`checkReferences` and is then detected exactly when `decodeText` would accept
the blob.

Registration is a function rather than a struct literal for one concrete
reason: `Ts<T>` has to be inferred from the schema. In
`dialectEntry(revisionSchema, r => …)` the parameter `r` types as `Revision` at
the call site; a bare `{ type, extraValidate }` object makes every author write
`(_: Ts<typeof revisionSchema>)` by hand. What it *returns* is a struct — the
entry the detector consumes, with the schema and the predicate collapsed into
one `match`.

**Names, since `fjs/media/revision` already has a `dialect` export** (the
string const `'vnd.fjs.revision'`, `module.f.ts:31`). The registration function
is therefore `dialectEntry`, not `dialect`, so no importer has to alias it, and
`revision` exports its entry as `revisionDialect` — matching the
`revisionSchema` naming already in that module:

```ts
// fjs/media/revision/module.f.ts
export const revisionDialect: DialectEntry<typeof dialect> =
    dialectEntry(revisionSchema, r => checkReferences(r)[0] === 'ok')

// fjs/mcp/cas/module.f.ts
import { detect } from '../../media/module.f.ts'
import { revisionDialect } from '../../media/revision/module.f.ts'
const detectDialect = detect([revisionDialect])
```

`fjs/mcp/cas` keeps its existing local name `detectDialect` for the bound
classifier, so its two call sites change only in where the function comes
from.

**No grammar check or allowlist on the dialect name.** A schema could say
`dialect: 'foo'`, and `detect` would report `application/foo+json`. That is
intended: `vnd.fjs.*` is this repo's convention for its *own* formats, not a
constraint on what a caller may detect — another vendor's `vnd.rogaikopyta.*`
blob, or a widely used name that is not under `vnd.` at all, is a legitimate
thing to register, and an allowlist here would only stop callers from
describing the formats they actually handle. The name is also not attacker-
controlled: it comes from a schema a programmer wrote and passed to
`dialectEntry`,
never from the blob being classified, so no untrusted string reaches
`mime_type` along this path. That is what distinguishes it from
[detect-cbor](detect-cbor.md)'s tier 2, which reads the dialect name *out of
the blob* and therefore does need the RFC 6838 grammar check and the
`vnd.fjs.*` allowlist before echoing it into a media type. Registering a name
that is not a valid RFC 6838 restricted-name yields a malformed media type in
the registrant's own results, and nowhere else.

Because an entry is (almost) data — a schema and one bounded predicate — most
of the open design questions settle:

- **The media type is derived, not supplied.** `application/${dialect}+json`,
  the same mechanical derivation `fjs/media/revision` already documents, read
  off the schema's own literal. An entry has no `mediaType` field to get wrong
  or to disagree with the schema it validates. The derivation is a runtime
  one: `DetectMeta.mime_type` is `string`, so no template-literal type survives
  into a detection verdict no matter how the entry is typed, and `revision`
  keeps its own `mediaType` const for callers that want the precise type.
  `DialectEntry<S>` is generic in the name anyway — erased to
  `DialectEntry<string>` only where `detect` consumes the heterogeneous list —
  so a caller reading a single entry keeps the literal; that is the only place
  it can survive.
- **The entry names a dialect, not an encoding.** Erase to
  `{ dialect, match }`, not `{ mediaType, match }`: the `+json` suffix is the
  JSON detector's to append. Nothing else is needed today — there is no CBOR
  codec yet, so `fjs/media/type` has no CBOR path to detect through — but the
  same entries are what [detect-cbor](detect-cbor.md) would validate against
  when there is one, deriving `application/{dialect}+cbor` from the same name.
  Keeping the name rather than a finished media type costs nothing now and
  avoids a second registry, or a media-type string to parse back apart, later.
- **The tag and the schema cannot disagree.** With one field there is no entry
  that claims `vnd.fjs.foo` while validating `vnd.fjs.bar` blobs — no
  consistency rule for `detect` to enforce, and none for a proof to cover.
- **Parsing happens once.** Detection JSON-parses the text a single time and
  calls each entry's `match` on the parsed value. Validation lives in the
  entry, not the detector: `dialectEntry` closes over
  `rtti/validate`'s `validate(type)` and its `extraValidate`, and `match` runs
  the structural check followed by the refinement on the same value. `detect`
  never sees `type` or `extraValidate` — it walks the list calling `match` and
  takes the first `true`. N dialects therefore cost N structural validations,
  not N parses; the "N decoders, N parses" cost of a `decodeText`-shaped entry
  never arises.
- **The one function an entry contributes is narrow.** A `decodeText`-shaped
  entry owns parsing, so it does arbitrary work on bytes of unknown provenance
  — exactly the input `detect` exists to classify. `extraValidate` never sees
  those bytes: it runs only on an already-parsed, already-structurally-valid,
  already size-bounded `Ts<T>`, and it returns `boolean`, so it has no error
  channel to abuse and nothing to report but yes or no. Detection keeps the
  parse and the schema walk; the dialect supplies a predicate over its own
  type.

Detection needs no separate tag check on top of validation: matching `dialect`
as an exact string literal is what makes structural validation alone reject
every other dialect's blob, so disjointness is a property of the entries rather
than a rule `detect` enforces. First match still wins for entries that overlap
anyway.

**The `dialect` member must be a direct string const**, not a thunk. rtti
admits both forms — `dialect: 'vnd.fjs.revision'` and
`() => ['const', 'vnd.fjs.revision']` — and `DialectType` above accepts only
the first, since a thunk is not a `string`. That is the decision, not an
implementer's choice: the direct form
is what `revisionSchema` already uses, it is what rtti's own docstring
prescribes outside recursive definitions, it makes `type.dialect` readable
without evaluating anything, and it is enforceable at compile time by the entry
type rather than at registration time by a runtime check. The requirement is
narrow and always satisfiable — it constrains one member of the top-level
struct, so a schema that needs thunks anywhere else, recursion included, is
unaffected, and an author holding a thunk-form schema writes the string
directly instead. A thunk-form `dialect` is still a perfectly valid rtti
schema; it just is not registerable, and `dialectEntry()` will not compile with
one.

**The dialect list is a parameter, and `detect` breaks.** `detect(dialects)`
returns the classifier, so today's `detect(bytes)` becomes
`detect(dialects)(bytes)` — a breaking change to a public export, made rather
than worked around: a module-level registry would trade the purity and the
explicit call site for registration-order questions, and a compatibility shim
would keep exactly the hardcoded default this issue exists to remove. Per
[AGENTS.md §8.4](../../../AGENTS.md#84-breaking-changes-and-versioning), every
importer is updated in the same PR — `fjs/mcp/cas/module.f.ts` (two call sites)
and `fjs/media/proof.f.ts` — and the CHANGELOG entry is prefixed
`**BREAKING CHANGES:**`.

The `revisionDialect` entry itself belongs in `fjs/media/revision`, which owns
both halves of it. `fjs/media` then imports no dialect at all — the hardcoded
import from the Problem section disappears instead of being re-exported under
another name — and `fjs/mcp/cas` passes the list it wants.

**How strict detection is, is the dialect's call.** With `extraValidate`
defaulting to `() => true`, a dialect that registers a bare schema gets
classification: `detect` reports what a blob claims to be and structurally
looks like, and the caller's own decoder stays the authority on whether it is
usable. A dialect that registers a predicate gets detection as strict as its
decoder. Neither is a special case in `detect` — the difference is entirely in
the entry.

`revision` should register `checkReferences`, so that although the API breaks,
the verdicts do not change: a blob satisfying `revisionSchema` with
`"snapshot": "not a hash"` keeps classifying as `text/plain` rather than
`application/vnd.fjs.revision+json`. That costs a one-line adapter —
`checkReferences` returns `Result<Revision, string>` and the entry wants
`boolean` — which is the right direction anyway: detection has no use for the
error message, and discarding it at the boundary keeps the predicate's
signature the minimal one.

The residual cost is that a `mime_type` from `detect` is a claim about a blob's
shape, not a promise that decoding it succeeds — a dialect that supplies no
predicate makes it a weaker claim than its own decoder would. Say so in the
module docstring, and keep it true by never routing a decode decision through
`detect`'s verdict.

**`DetectMeta` is unchanged: no `dialect` field.** A matched entry is reported
only through the derived `mime_type`, as today. `DetectMeta` is
`fjs/media/type`'s result shape, shared with the dialect-unaware `detectStream`
— putting a dialect field on it would place a dialect concept in the one layer
that must not have one, and would leave that field permanently `undefined` on
every streaming verdict. The caller loses little: it supplied the entry list,
so it can compare `mime_type` against its own entries, and detection only ever
claims a blob's shape, so a caller that intends to decode calls its dialect's
decoder regardless. If a caller ever genuinely needs the matched entry, the
place to widen is `fjs/media`'s own return type, not `fjs/media/type`'s —
a separate change, and out of scope here.

Two properties of the current implementation are deliberate and easy to lose
while adding a registry:

- **Detection is semantic, not syntactic.** Any JSON satisfying a dialect's
  schema is recognized regardless of key order or whitespace — the docstring
  calls this out and specifically rules out a byte-level `{"dialect":` prefix
  check. A registry makes such a shortcut tempting as an optimization (read the
  tag, then dispatch to one schema); it would change the contract. Note that
  schema validation already subsumes the tag check, so the shortcut buys only
  the difference between one validation and N.
- **Dialect detection is size-bounded by construction.** It runs only on a
  single already-buffered `Vec` (capped at `maxLength`, 128 KiB) because schema
  validation needs the whole parsed value. `fjs/media/type`'s `detectStream`
  stays a pure byte-signature/UTF-8 classifier with no dialect awareness. A
  registry must not push dialect validation into the streaming path.

### Tasks

- [ ] Implement `dialectEntry(type, extraValidate?)` as written above — it owns
      validation, closing over `validate(type)` and `extraValidate` inside
      `match`; the returned `DialectEntry<T['dialect']>` is generic in the name
      so the literal is not widened at the return boundary.
- [ ] Implement in `fjs/media/module.f.ts`: `detect(dialects)(bytes)` — parse
      once, call each entry's `match` on the parsed value, and append `+json`
      to the first matching entry's `dialect`. `detect` handles no schemas and
      no refinements of its own, and no dialect import remains in this module.
- [ ] Add `revisionDialect` to `fjs/media/revision` —
      `dialectEntry(revisionSchema, r => checkReferences(r)[0] === 'ok')` —
      keeping the existing `dialect` string const untouched.
- [ ] Update every importer in the same PR — `fjs/mcp/cas/module.f.ts` (two
      `detectDialect` call sites) and `fjs/media/proof.f.ts` — and add a
      `**BREAKING CHANGES:**` CHANGELOG entry per AGENTS.md §8.4. No
      compatibility shim.
- [ ] Keep the `DialectType = StringMap<'dialect', string>` constraint as
      written — it is what rejects a schema with no `dialect` member or a
      thunk-form one at the call site, and the alternatives above do not
      compile. Do **not** grammar-check or allowlist the name — record why in
      the JSDoc, since the rule differs from
      [detect-cbor](detect-cbor.md)'s blob-supplied names.
- [ ] Proof coverage in `fjs/media/proof.f.ts`: a second dialect is recognized;
      first-match-wins ordering; no match falls through to the `fjs/media/type`
      verdict unchanged; a `revision` blob still reports
      `application/vnd.fjs.revision+json`; a structurally valid revision with a
      non-cbase32 `snapshot` still falls through to `text/plain` (the
      `extraValidate` path); an entry registered without a predicate matches on
      structure alone; and a non-`vnd.fjs.*` dialect name yields its own derived
      type.
- [ ] Confirm `detectStream` is untouched and still dialect-unaware.

### Related

- [`fjs/media/module.f.ts`](../module.f.ts) — `detect`, the hardcoded `revision`
  import.
- [`fjs/media/type/module.f.ts`](../type/module.f.ts) — `detectVec` /
  `detectStream`, the layer below.
- [`fjs/media/revision/module.f.ts`](../revision/module.f.ts) — `revisionSchema`
  and `checkReferences`, the two halves of the entry this module should export
  (`checkReferences` is already exported separately, for callers that have a
  typed `Revision` — exactly this case), plus `decodeText` / `mediaType`.
- [`fjs/media/revision/README.md`](../revision/README.md) — the `vnd.fjs.<name>`
  convention this gap makes only partially usable, and the mechanical media-type
  derivation an entry relies on instead of naming its own.
- [`fjs/mcp/cas/module.f.ts`](../../mcp/cas/module.f.ts) — the only non-proof
  importer of `detect`; updated in the same PR as the breaking change.
- [detect-cbor](detect-cbor.md) — would reuse these entries for
  `application/{dialect}+cbor`; its tier-2 names come from the blob, hence its
  allowlist and this module's lack of one.
- [`fjs/types/rtti/module.f.ts`](../../types/rtti/module.f.ts) — `Struct` /
  `Type` / `Const`; `Struct` is what a dialect schema is, though the entry's
  constraint is `StringMap<'dialect', string>` (see the compile notes above).
- [`fjs/types/object/module.f.ts`](../../types/object/module.f.ts) —
  `StringMap`, which spells that constraint.
- [`fjs/types/rtti/validate/module.f.ts`](../../types/rtti/validate/module.f.ts)
  — `validate`, what detection runs per entry over the once-parsed value.
