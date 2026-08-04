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

Make the set of dialects a parameter rather than an import.

`fjs/media/revision` already exports exactly the pair an entry needs —
`decodeText: (text: string) => Result<T, E>` and `mediaType: string` — so its
own shape is the natural interface, and no new type has to be invented:

```ts
export type Dialect = {
    readonly decodeText: (text: string) => Result<unknown, unknown>
    readonly mediaType: string
}
```

`detect` tries each in order and reports the first whose `decodeText` returns
`ok`, falling through to the `fjs/media/type` verdict when none match. Keep the
current zero-argument `detect` as a binding over `[revision]` so existing
callers are unaffected.

Whether the list is a parameter (`detect(dialects)(bytes)`) or a module-level
registry is an API-taste call for this repo; a parameter keeps the module pure
and avoids registration-order questions, at the cost of every caller naming the
dialects it cares about.

Two properties of the current implementation are deliberate and easy to lose
while adding a registry:

- **Detection is semantic, not syntactic.** Any JSON satisfying a dialect's
  schema is recognized regardless of key order or whitespace — the docstring
  calls this out and specifically rules out a byte-level `{"dialect":` prefix
  check. A registry makes such a shortcut tempting as an optimization (test the
  tag, then dispatch to one decoder); it would change the contract.
- **Dialect detection is size-bounded by construction.** It runs only on a
  single already-buffered `Vec` (capped at `maxLength`, 128 KiB) because schema
  validation needs the whole parsed value. `fjs/media/type`'s `detectStream`
  stays a pure byte-signature/UTF-8 classifier with no dialect awareness. A
  registry must not push dialect validation into the streaming path.

Trying N decoders is N JSON parses in the worst case. If that matters, parse
once and validate the parsed value against each schema — but note that
`decodeText` is the exported entry point today, so a parse-once design wants a
`validate`-shaped member in the entry type instead of, or alongside,
`decodeText`.

### Tasks

- [ ] Decide the entry shape (`{ decodeText, mediaType }` vs. a `validate`-based
      one that parses once) and whether dialects are a parameter or a registry.
- [ ] Implement in `fjs/media/module.f.ts`; keep a default wired to `[revision]`
      so current callers and their results are unchanged.
- [ ] Proof coverage in `fjs/media/proof.f.ts`: a second dialect is recognized;
      first-match-wins ordering; no match falls through to the `fjs/media/type`
      verdict unchanged; a `revision` blob still reports
      `application/vnd.fjs.revision+json` through the default.
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
  convention this gap makes only partially usable.
