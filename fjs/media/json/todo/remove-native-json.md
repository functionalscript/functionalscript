## remove-native-json. Get rid of `JSON.stringify`

**Priority:** P3
**Status:** open

### Problem

`fjs/media/json` owns a complete JSON pipeline written in FunctionalScript —
`tokenize` → `parse` for reading, `serialize` / `stringify` for writing. The
reading half is done: `parseNative` is gone and every call site goes through
the total, `Result`-returning `parse`. The writing half is still the host's:

- **117 call sites call `JSON.stringify` directly** — and one of them is
  `fjs/media/json/serializer/module.f.ts:9`, so the FunctionalScript serializer
  itself bottoms out in the host. `stringSerialize` and `numberSerialize` are
  `JSON.stringify` with a different name, and `fjs/djs/serializer/module.f.ts:15`
  imports both, so *every* value this repository serializes — JSON and DJS
  alike — is ultimately formatted by the host.

Three reasons to finish the job:

1. **Two shapes for one concept.** `AGENTS.md` §5.2 treats keeping an old API
   next to the new one as a last resort — "in practice, the old one never
   leaves." That is what happened on the reading side until `parseNative` was
   deleted, and it is what the write side still looks like.
2. **`JSON` is a host global with no FunctionalScript definition.** Nothing in
   `fjs/` defines it and NaNVM (`nanvm-lib/src`) has no `JSON` object, so a
   `.f.ts` module reaching for it depends on the JS host rather than on
   FunctionalScript — and a "FunctionalScript JSON serializer" that calls the
   host to format its strings and numbers is not one.
3. **It is the last host dependency in the pipeline.** With reading migrated,
   `serialize`'s two leaves are the only thing between this module and being
   self-hosted end to end.

#### `JSON.stringify` — 117 sites in six shapes

| Shape | Sites | Where | Replacement |
| --- | --- | --- | --- |
| **Leaf serializers** | 1 | `fjs/media/json/serializer/module.f.ts:9` | FunctionalScript escaping + number formatting — blocks everything below |
| Expected-output comparison | 75 | `fjs/bnf/ll1/proof.f.ts` (27), `fjs/bnf/descent/proof.f.ts` (22), `fjs/media/json/serializer/proof.f.ts` (12), `fjs/djs/tokenizer/proof.f.ts:795-829` (8), `fjs/bnf/data/proof.f.ts` (4), `fjs/media/revision/proof.f.ts:138`, `fjs/cas/evo/proof.f.ts:57` | `stringify(identity)` |
| Assertion messages | 33 | `fjs/djs/tokenizer/proof.f.ts` (31), `fjs/types/rtti/ts/proof.f.ts:8,12` (2) | pass the value, or `fjs/djs`'s `stringify` |
| Source-text quoting | 5 | `fjs/emergent_testing/module.f.ts:305,322,335`, `fjs/types/ts/module.f.ts:36,48` | `stringSerialize` — already designed in `66c-emit-literals-via-owner-modules.md` |
| JSON line framing | 2 | `fjs/emergent_testing/proof.f.ts:42`, `fjs/mcp/proof.f.ts:128` | `stringify(identity)` |
| Pretty-printed file output | 1 | `fjs/ci/module.f.ts:81` | needs indentation support, which `serialize` does not have |

Three semantic differences to respect while migrating, none of them blocking:

- **Key order.** `stringify(sort)` sorts keys; native uses insertion order. Use
  `stringify(identity)` where an expected literal encodes native order, or
  re-sort the literal where order-independence is what the test wants (see
  `stringify-sorted-canonical.md`).
- **`undefined` and `bigint`.** Native drops `undefined` object fields, turns
  them into `null` inside arrays, and throws on `bigint`. `serialize` takes
  `Unknown`, which excludes `undefined` outright, and `definedEntries` does the
  dropping — so `fjs/protocol/mcp/stdio/proof.f.ts:102`'s omission test keeps
  its meaning. `bigint` values (the DJS token payloads behind the 31 message
  sites) need `fjs/djs`'s serializer, which already handles them.
- **Types.** `serialize` demands `Unknown`; the proof sites pass domain types
  (`dm`, `mr`, `emptyTags`). Confirm each is structurally assignable rather
  than reaching for `as` — where it isn't, that is a finding about the domain
  type, not a reason to keep native.

### Proposal

Four phases. They are separable and each is a complete change on its own, so
they should ship as separate PRs (§8.1); phases 1 and 2 gate the migration.

**1. `stringSerialize` in FunctionalScript.** Escape `"`, `\`, the short forms
`\b \f \n \r \t`, and every other code point below `0x20` as `\u00XX`, over
`fjs/text/utf16`. It must match the host exactly, including well-formed
`JSON.stringify` (ES2019) escaping of lone surrogates as `\uD800` — the
migrated proofs compare against literals the host produced, so any divergence
surfaces as a test failure rather than silently. This is ordinary
FunctionalScript work and unblocks the source-text-quoting sites too.

**2. `numberSerialize` in FunctionalScript — its own issue.** This is the one
genuinely hard piece: `JSON.stringify(x)` on a finite number is ECMAScript
`Number::toString`, i.e. the *shortest decimal that round-trips* — a numeric
algorithm (Steele & White / Grisu / Ryū), not a JSON concern. Per §5.1 it
belongs in its own `todo/` file next to the numeric code (`fjs/types/bigfloat`
already has `decToBin` and is the natural home) rather than folded in here.
Two details for whoever takes it: the shortest-round-trip contract is the whole
specification (`0.1` must not print as `0.1000000000000000055511151231257827`),
and the non-finite cases differ between the two host entry points —
`JSON.stringify` emits `null` for `NaN`/`±Infinity` while `String` emits
`NaN`/`Infinity`, so the replacement must keep the `JSON.stringify` behavior
today's callers see.

**3. Migrate the 117 write sites** by the shape table above, once 1 and 2 land.
The source-text-quoting row is already designed in
`fjs/fsc/todo/66c-emit-literals-via-owner-modules.md` — route those through it
instead of duplicating the decision. The assertion-message row is the cheapest:
§3.4 says a thrown payload is read only by a human after something already went
wrong, so most of those 33 sites can pass the value itself — but note that the
reporter renders a failure payload with `String(v)`
(`fjs/emergent_testing/module.f.ts:384`), so passing a raw object degrades the
message. Either serialize with `fjs/djs`'s `stringify` (it handles the `bigint`
token payloads) or improve the reporter's rendering first.

**4. Indentation for `fjs/ci/module.f.ts:81`**, the only site asking for
something `serialize` cannot do (`JSON.stringify(gha, null, '  ')`). Add an
indenting variant to `fjs/media/json/serializer` — the natural shape is
`serialize` parameterized by an indent unit, with today's behavior as the
empty-indent case, rather than a second serializer beside it. This also unblocks
`fjs/effects/node/todo/readjsonfile-writejsonfile-helpers.md`, whose
`writeJsonFile` sketch needs indented output.

When all four are done, `JSON` should appear nowhere in `fjs/` outside prose.
Consider a guard so it does not come back — the cheapest is a proof in
`fjs/dev` that walks the source tree, in the spirit of the existing
`shouldLoad`-based tooling.

### Tasks

- [ ] Phase 1: FunctionalScript `stringSerialize`, with proof coverage for
      every escape class including lone surrogates.
- [ ] Phase 2: file the shortest-round-trip number-formatting issue under
      `fjs/types/bigfloat/todo/`, then implement `numberSerialize` on it.
- [ ] Phase 3: migrate the write sites, row by row from the shape table.
- [ ] Phase 4: indenting serializer; migrate `fjs/ci/module.f.ts`.
- [ ] Per phase: `npx tsc`, `fjs t`, `npm run cov`, and a CHANGELOG entry.

### Related

- [`fjs/media/json/serializer/module.f.ts`](../serializer/module.f.ts) — the
  leaf `JSON.stringify` phases 1 and 2 replace.
- [`fjs/fsc/todo/66c-emit-literals-via-owner-modules.md`](../../../fsc/todo/66c-emit-literals-via-owner-modules.md)
  — already owns the source-text-quoting sites (`fjs/types/ts`,
  `fjs/emergent_testing`); phase 3 defers to it rather than re-deciding.
- [`fjs/types/object/todo/structurally-same.md`](../../../types/object/todo/structurally-same.md)
  — `fjs/cas/evo/proof.f.ts:57` stringifies two values only to compare them;
  `structurallySame` is the better fix for that one site.
- [`fjs/effects/node/todo/readjsonfile-writejsonfile-helpers.md`](../../../effects/node/todo/readjsonfile-writejsonfile-helpers.md)
  — an on-hold design whose `writeJsonFile` half waits on phase 4.
- [stringify-sorted-canonical](./stringify-sorted-canonical.md) — the key-order
  question phase 3 meets at every comparison site.
- `parse`'s per-container call-stack cost was found while migrating the reading
  sites — it panicked past ~5000 containers, which is why one proof compares a
  serialized dump as text rather than round-tripping it. Fixed in
  [#1435](https://github.com/functionalscript/functionalscript/pull/1435); the
  dump round-trip is available again if that proof is ever revisited.
- [streaming-recognizer](./streaming-recognizer.md) — the cost profile of this
  module's own pipeline (O(n) value, O(token) buffering); relevant if a
  migrated proof turns out to be slow.
