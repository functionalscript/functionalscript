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
entry can say to a dialect name plus an rtti schema** — nothing else:

```ts
export type Dialect = {
    readonly dialect: string
    readonly schema: Type // `fjs/types/rtti` `Type`
}
```

An entry is data, not code. That single restriction settles most of the open
design questions:

- **The media type is derived, not supplied.** `application/${dialect}+json`,
  the same mechanical derivation `fjs/media/revision` already documents. An
  entry cannot name an arbitrary `mime_type`, so a registered dialect can only
  ever claim its own `vnd.fjs.<name>` type — no `mediaType` field to get wrong,
  and nothing to allowlist after the fact.
- **Parsing happens once.** Detection JSON-parses the text a single time and
  runs `rtti/validate`'s `validate(schema)` over the parsed value for each
  entry, so N dialects cost N structural validations, not N parses. The
  "N decoders, N parses" cost of a `decodeText`-shaped entry never arises.
- **No caller-supplied code runs during detection.** A registry of functions
  would let any entry do arbitrary work — throw, recurse, or take
  pathological time — on bytes of unknown provenance, which is exactly the
  input `detect` exists to classify. Validating data against a schema cannot.

Dialect schemas are self-discriminating, so this does not need a separate tag
check: `revisionSchema` matches `dialect` as an exact string literal, so
structural validation alone rejects every other dialect's blob. Require the
same of any registered entry — a schema whose `dialect` field is the literal
`dialect` of the entry — and disjointness is a property of the entries, not a
rule `detect` has to enforce. First match still wins for entries that overlap
anyway.

Keep the current zero-argument `detect` as a binding over `[revision]`.
Whether the list is a parameter (`detect(dialects)(bytes)`) or a module-level
registry is an API-taste call for this repo; a parameter keeps the module pure
and avoids registration-order questions, at the cost of every caller naming the
dialects it cares about.

**The one consequence to decide.** rtti validation is structural only, and
`revision`'s `decodeText` is structural *plus* `checkReferences` — cbase32
hashes, non-negative safe-integer `generation`. A blob that satisfies
`revisionSchema` but carries `"snapshot": "not a hash"` classifies as
`text/plain` today and would classify as `application/vnd.fjs.revision+json`
under a schema-only entry. Two ways to take it:

1. Accept the widening: `detect` classifies, it does not validate. It reports
   what a blob claims to be and structurally looks like; the caller's own
   `decodeText` stays the authority on whether it is usable. This keeps every
   entry pure data.
2. Keep semantic refinement out of the entry but let the default `[revision]`
   binding re-check it, so the default path's results are bit-for-bit what they
   are today — at the cost of the default no longer being expressible as a
   plain entry list, which is most of the point.

Option 1 is the simpler contract and the one this proposal assumes; it is
called out because it changes an existing result.

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

- [ ] Decide the structural-only widening (option 1 vs. 2 above) and whether
      dialects are a parameter or a registry. The entry shape itself is settled:
      `{ dialect, schema }`, no functions, media type derived.
- [ ] Implement in `fjs/media/module.f.ts`: parse once, then `validate(schema)`
      per entry; keep a default wired to `[revision]` so current callers are
      unaffected.
- [ ] Require each entry's schema to pin its own `dialect` literal (how
      `revisionSchema` already does it) — document it, and decide whether
      `detect` checks it or the convention is enough.
- [ ] Proof coverage in `fjs/media/proof.f.ts`: a second dialect is recognized;
      first-match-wins ordering; no match falls through to the `fjs/media/type`
      verdict unchanged; a `revision` blob still reports
      `application/vnd.fjs.revision+json` through the default; and — per the
      widening decision — a structurally valid revision with a non-cbase32
      `snapshot`, pinning whichever verdict was chosen.
- [ ] Confirm `detectStream` is untouched and still dialect-unaware.
- [ ] Check whether `DetectMeta` needs to carry the matched dialect itself, not
      only the derived `mime_type` — a caller that matched is usually about to
      decode, and currently has to re-derive which dialect hit.

### Related

- [`fjs/media/module.f.ts`](../module.f.ts) — `detect`, the hardcoded `revision`
  import.
- [`fjs/media/type/module.f.ts`](../type/module.f.ts) — `detectVec` /
  `detectStream`, the layer below.
- [`fjs/media/revision/module.f.ts`](../revision/module.f.ts) — `decodeText`,
  `mediaType`, `dialect`; the reference implementation of the pattern and the de
  facto entry shape.
- [`fjs/media/revision/README.md`](../revision/README.md) — the `vnd.fjs.<name>`
  convention this gap makes only partially usable, and the mechanical media-type
  derivation an entry relies on instead of naming its own.
- [`fjs/types/rtti/module.f.ts`](../../types/rtti/module.f.ts) — `Type`, the
  entry's schema half.
- [`fjs/types/rtti/validate/module.f.ts`](../../types/rtti/validate/module.f.ts)
  — `validate`, what detection runs per entry over the once-parsed value.
