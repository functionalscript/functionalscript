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
// `Struct` from `fjs/types/rtti`: a struct schema whose `dialect` member is a
// string const — the subset of `Type` that names its own dialect.
export type DialectType = Struct & { readonly dialect: string }

/** Registers a dialect for detection: its schema, plus whatever rtti can't say. */
export const dialect = <T extends DialectType>(
    type: T,
    extraValidate: (_: Ts<T>) => boolean = () => true,
): Dialect => /* … */
```

A dialect schema is already a struct whose `dialect` member is a string const —
that is how `revisionSchema` is written, and it is what makes the schema
self-discriminating. So the dialect name is *in* the schema, and a separate
`dialect` field alongside it would be a second copy that can disagree with the
first. `detect` reads `type.dialect` and derives the media type from it.

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
`dialect(revisionSchema, r => …)` the parameter `r` types as `Revision` at the
call site; a bare `{ type, extraValidate }` object makes every author write
`(_: Ts<typeof revisionSchema>)` by hand. What it *returns* can be a struct —
an erased entry the detector consumes, e.g.
`{ mediaType, match: (u: Unknown) => boolean }`, with the generic gone.

Because an entry is (almost) data — a schema and one bounded predicate — most
of the open design questions settle:

- **The media type is derived, not supplied.** `application/${dialect}+json`,
  the same mechanical derivation `fjs/media/revision` already documents, read
  off the schema's own literal. An entry cannot name an arbitrary `mime_type`,
  so a registered dialect can only ever claim its own `vnd.fjs.<name>` type —
  no `mediaType` field to get wrong, and nothing to allowlist after the fact.
  The generic `T` keeps the literal, so the derived media type can stay a
  template-literal type the way `revision`'s `mediaType` is today.
- **The tag and the schema cannot disagree.** With one field there is no entry
  that claims `vnd.fjs.foo` while validating `vnd.fjs.bar` blobs — no
  consistency rule for `detect` to enforce, and none for a proof to cover.
- **Parsing happens once.** Detection JSON-parses the text a single time and
  runs `rtti/validate`'s `validate(type)` over the parsed value for each entry,
  with `extraValidate` on the same value when that succeeds. N dialects cost N
  structural validations, not N parses — the "N decoders, N parses" cost of a
  `decodeText`-shaped entry never arises.
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

One wrinkle to pin down: rtti admits both the direct const form
(`dialect: 'vnd.fjs.revision'`) and the thunk form
(`() => ['const', 'vnd.fjs.revision']`). `DialectType` above accepts only the
direct form — what `revisionSchema` uses, and what keeps `type.dialect`
readable without evaluating anything. Either require it or unwrap the thunk
when reading the name.

Keep the current zero-argument `detect` as a binding over the single default
entry, `dialect(revisionSchema, r => checkReferences(r)[0] === 'ok')`.
Whether the list is a parameter (`detect(dialects)(bytes)`) or a module-level
registry is an API-taste call for this repo; a parameter keeps the module pure
and avoids registration-order questions, at the cost of every caller naming the
dialects it cares about.

**How strict detection is, is the dialect's call.** With `extraValidate`
defaulting to `() => true`, a dialect that registers a bare schema gets
classification: `detect` reports what a blob claims to be and structurally
looks like, and the caller's own decoder stays the authority on whether it is
usable. A dialect that registers a predicate gets detection as strict as its
decoder. Neither is a special case in `detect` — the difference is entirely in
the entry.

`revision` should register `checkReferences`, so today's results are preserved
exactly: a blob satisfying `revisionSchema` with `"snapshot": "not a hash"`
keeps classifying as `text/plain` rather than
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

- [ ] Decide whether dialects are a parameter or a module-level registry. The
      entry shape itself is settled: `dialect(type, extraValidate?)` — an rtti
      schema plus an optional `Ts<T> => boolean` refinement, with the dialect
      name and media type both read off the schema.
- [ ] Implement `dialect` and the erased entry it returns; confirm `Ts<T>` is
      inferred at the call site so `extraValidate`'s parameter needs no
      annotation (this is the reason registration is a function).
- [ ] Implement in `fjs/media/module.f.ts`: parse once, `validate(type)` per
      entry, then `extraValidate` on success, deriving the media type from
      `type.dialect`; default to `dialect(revisionSchema, checkReferences`-as-
      predicate`)` so current results are unchanged.
- [ ] Type `DialectType` so a schema without a string `dialect` member is
      rejected at compile time, and decide the thunk-form question (require the
      direct const, or unwrap when reading the name).
- [ ] Proof coverage in `fjs/media/proof.f.ts`: a second dialect is recognized;
      first-match-wins ordering; no match falls through to the `fjs/media/type`
      verdict unchanged; a `revision` blob still reports
      `application/vnd.fjs.revision+json` through the default; a structurally
      valid revision with a non-cbase32 `snapshot` still falls through to
      `text/plain` (the `extraValidate` path); and an entry registered without a
      predicate matches on structure alone.
- [ ] Confirm `detectStream` is untouched and still dialect-unaware.
- [ ] Check whether `DetectMeta` needs to carry the matched dialect itself, not
      only the derived `mime_type` — a caller that matched is usually about to
      decode, and currently has to re-derive which dialect hit.

### Related

- [`fjs/media/module.f.ts`](../module.f.ts) — `detect`, the hardcoded `revision`
  import.
- [`fjs/media/type/module.f.ts`](../type/module.f.ts) — `detectVec` /
  `detectStream`, the layer below.
- [`fjs/media/revision/module.f.ts`](../revision/module.f.ts) — `revisionSchema`
  and `checkReferences`, the two halves of the default entry (`checkReferences`
  is already exported separately, for callers that have a typed `Revision` —
  exactly this case), plus `decodeText` / `mediaType`.
- [`fjs/media/revision/README.md`](../revision/README.md) — the `vnd.fjs.<name>`
  convention this gap makes only partially usable, and the mechanical media-type
  derivation an entry relies on instead of naming its own.
- [`fjs/types/rtti/module.f.ts`](../../types/rtti/module.f.ts) — `Struct` /
  `Type` / `Const`; an entry is the subset of `Type` with a string `dialect`
  member.
- [`fjs/types/rtti/validate/module.f.ts`](../../types/rtti/validate/module.f.ts)
  — `validate`, what detection runs per entry over the once-parsed value.
