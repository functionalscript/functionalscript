## remove-native-json. Get rid of `JSON.parse` and `JSON.stringify`

**Priority:** P3
**Status:** open

### Problem

`fjs/media/json` owns a complete JSON pipeline written in FunctionalScript —
`tokenize` → `parse` for reading, `serialize` / `stringify` for writing — yet
the host's `JSON` object is still what the repository actually runs on:

- **Reading:** all 21 call sites go through `parseNative`, this module's
  re-export of `JSON.parse`, rather than through `parse`.
- **Writing:** 117 call sites call `JSON.stringify` directly — and one of them
  is `fjs/media/json/serializer/module.f.ts:9`, so the FunctionalScript
  serializer itself bottoms out in the host. `stringSerialize` and
  `numberSerialize` are `JSON.stringify` with a different name, and
  `fjs/djs/serializer/module.f.ts:15` imports both, so *every* value this
  repository serializes — JSON and DJS alike — is ultimately formatted by the
  host.

Four reasons to remove both:

1. **Two shapes for one concept.** `AGENTS.md` §5.2 treats keeping an old API
   next to the new one as a last resort — "in practice, the old one never
   leaves." That is exactly what happened: `parse` landed and nothing moved.
2. **`JSON.parse` throws.** A `throw` in FunctionalScript is a panic (§3.4):
   nothing can catch it, so malformed input kills the program instead of
   producing a value the caller destructures. `parse` returns a `Result`.
3. **`JSON.parse` returns `any`, which invites `as`.** `fjs/mcp/proof.f.ts`
   alone carries 17 `as CasGetResult` casts over a hand-written type that no
   schema backs (§6.2 "avoid `as`").
4. **`JSON` is a host global with no FunctionalScript definition.** Nothing in
   `fjs/` defines it and NaNVM (`nanvm-lib/src`) has no `JSON` object, so a
   `.f.ts` module reaching for it depends on the JS host rather than on
   FunctionalScript — and a "FunctionalScript JSON serializer" that calls the
   host to format its strings and numbers is not one.

#### `JSON.parse` — 21 sites, all in proofs

Nothing in production code parses JSON natively.

| Site | Count | Shape |
| --- | --- | --- |
| `fjs/media/json/module.f.ts:143` | 1 | the `parseNative` export |
| `fjs/media/json/proof.f.ts:79-80` | 1 | its coverage test |
| `fjs/mcp/proof.f.ts` | 17 | `JSON.parse(textOf(resp)) as CasGetResult`, plus one `stdout` line split at `:131` |
| `fjs/mcp/evo/proof.f.ts:61` | 1 | `JSON.parse(textOf(result)) as readonly string[]` |
| `fjs/ci/proof.f.ts:11,49` | 1 | `parseNative as jsonParse`, fed to `parseGitHubAction` |
| `fjs/emergent_testing/proof.f.ts:24-25` | 1 | one `Event` per stdout line |
| `fjs/djs/tokenizer/proof.f.ts:938` | 1 | `parsed.length` on a tokenizer dump |

#### `JSON.stringify` — 117 sites in six shapes

| Shape | Sites | Where | Replacement |
| --- | --- | --- | --- |
| **Leaf serializers** | 1 | `fjs/media/json/serializer/module.f.ts:9` | FunctionalScript escaping + number formatting — blocks everything below |
| Expected-output comparison | 75 | `fjs/bnf/ll1/proof.f.ts` (27), `fjs/bnf/descent/proof.f.ts` (22), `fjs/media/json/serializer/proof.f.ts` (12), `fjs/djs/tokenizer/proof.f.ts:795-829` (8), `fjs/bnf/data/proof.f.ts` (4), `fjs/media/revision/proof.f.ts:138`, `fjs/cas/evo/proof.f.ts:57` | `stringify(identity)` |
| Assertion messages | 33 | `fjs/djs/tokenizer/proof.f.ts` (31), `fjs/types/rtti/ts/proof.f.ts:8,12` (2) | pass the value, or `fjs/djs`'s `stringify` |
| Source-text quoting | 5 | `fjs/emergent_testing/module.f.ts:305,322,335`, `fjs/types/ts/module.f.ts:36,48` | `stringSerialize` — already designed in `66c-emit-literals-via-owner-modules.md` |
| JSON line framing | 2 | `fjs/emergent_testing/proof.f.ts:22`, `fjs/mcp/proof.f.ts:119` | `stringify(identity)` |
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

Five phases. They are separable and each is a complete change on its own, so
they should ship as separate PRs (§8.1); phases 2 and 3 gate the write side.

**1. Reading.** Replace each site with `unwrap(parse(text))` (`unwrap` from
`fjs/types/result/module.f.ts`), then delete `parseNative` — a breaking change
to a published export, so its CHANGELOG entry is prefixed
`**BREAKING CHANGES:**` (§8.4). Where the old code carried an `as`, use a
schema instead — the `text → Unknown → T` split this module was designed for:

```ts
// fjs/mcp/proof.f.ts — schema replaces the hand-written type and 17 casts
const casGetResult = {
    length: number,
    mimeType: string,
    type: string,
    uri: option(string),
    text: option(string),
    blob: option(string),
} as const

type CasGetResult = Ts<typeof casGetResult>

const parseCasGetResult = rttiParse(casGetResult)

const casGetResultOf = (resp: unknown): CasGetResult =>
    unwrap(parseCasGetResult(unwrap(parse(textOf(resp)))))
```

`fjs/mcp/evo/proof.f.ts` is the same pattern with `array(string)`, and
`fjs/ci/proof.f.ts` needs nothing new — `parseGitHubAction` already validates,
so `unwrap(parseGitHubAction(unwrap(parse(text(workflows, 'ci.yml')))))`.

Two reading sites need a decision rather than a substitution:

- **`fjs/emergent_testing/proof.f.ts`** parses each line into `Event`, a tagged
  tuple union whose payload includes `SandboxResult<unknown>`. Either write the
  rtti schema for `Event` and derive the type from it, or drop the round-trip
  and assert on the emitted lines as text.
- **`fjs/djs/tokenizer/proof.f.ts:938`** only reads `parsed.length` off a
  tokenizer dump — count the tokens from the token list the test already has,
  with no JSON step at all.

**2. `stringSerialize` in FunctionalScript.** Escape `"`, `\`, the short forms
`\b \f \n \r \t`, and every other code point below `0x20` as `\u00XX`, over
`fjs/text/utf16`. It must match the host exactly, including well-formed
`JSON.stringify` (ES2019) escaping of lone surrogates as `\uD800` — the
migrated proofs compare against literals the host produced, so any divergence
surfaces as a test failure rather than silently. This is ordinary
FunctionalScript work and unblocks the source-text-quoting sites too.

**3. `numberSerialize` in FunctionalScript — its own issue.** This is the one
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

**4. Migrate the 117 write sites** by the shape table above, once 2 and 3 land.
The source-text-quoting row is already designed in
`fjs/fsc/todo/66c-emit-literals-via-owner-modules.md` — route those through it
instead of duplicating the decision. The assertion-message row is the cheapest:
§3.4 says a thrown payload is read only by a human after something already went
wrong, so most of those 33 sites can pass the value itself — but note that the
reporter renders a failure payload with `String(v)`
(`fjs/emergent_testing/module.f.ts:384`), so passing a raw object degrades the
message. Either serialize with `fjs/djs`'s `stringify` (it handles the `bigint`
token payloads) or improve the reporter's rendering first.

**5. Indentation for `fjs/ci/module.f.ts:81`**, the only site asking for
something `serialize` cannot do (`JSON.stringify(gha, null, '  ')`). Add an
indenting variant to `fjs/media/json/serializer` — the natural shape is
`serialize` parameterized by an indent unit, with today's behavior as the
empty-indent case, rather than a second serializer beside it.

When all five are done, `JSON` should appear nowhere in `fjs/` outside prose.
Consider a guard so it does not come back — the cheapest is a proof in
`fjs/dev` that walks the source tree, in the spirit of the existing
`shouldLoad`-based tooling.

### Tasks

- [ ] Phase 1: migrate the six reading sites (decide the `Event` question
      first), delete `parseNative`, its proof test, and the `parseNative`
      mentions in the `fjs/media/json/module.f.ts` module header.
- [ ] Phase 2: FunctionalScript `stringSerialize`, with proof coverage for
      every escape class including lone surrogates.
- [ ] Phase 3: file the shortest-round-trip number-formatting issue under
      `fjs/types/bigfloat/todo/`, then implement `numberSerialize` on it.
- [ ] Phase 4: migrate the write sites, row by row from the shape table.
- [ ] Phase 5: indenting serializer; migrate `fjs/ci/module.f.ts`.
- [ ] Update `fjs/effects/node/todo/readjsonfile-writejsonfile-helpers.md`,
      whose sketch still calls both `JSON.parse` and `JSON.stringify`.
- [ ] Per phase: `npx tsc`, `fjs t`, `npm run cov`, and a CHANGELOG entry
      (`**BREAKING CHANGES:**` for the `parseNative` removal).

### Related

- [`fjs/media/json/module.f.ts`](../module.f.ts) and
  [`fjs/media/json/serializer/module.f.ts`](../serializer/module.f.ts) — the
  export this issue removes and the leaf `JSON.stringify` it replaces.
- [`fjs/fsc/todo/66c-emit-literals-via-owner-modules.md`](../../../fsc/todo/66c-emit-literals-via-owner-modules.md)
  — already owns the source-text-quoting sites (`fjs/types/ts`,
  `fjs/emergent_testing`); phase 4 defers to it rather than re-deciding.
- [`fjs/types/object/todo/structurally-same.md`](../../../types/object/todo/structurally-same.md)
  — `fjs/cas/evo/proof.f.ts:57` stringifies two values only to compare them;
  `structurallySame` is the better fix for that one site.
- [`fjs/djs/todo/json-bigint-serialization.md`](../../../djs/todo/json-bigint-serialization.md)
  — cites the `parse` / `parseNative` split as precedent for its `parseWith`
  design; that reference becomes history once `parseNative` is gone.
- [`fjs/effects/node/todo/readjsonfile-writejsonfile-helpers.md`](../../../effects/node/todo/readjsonfile-writejsonfile-helpers.md)
  — an on-hold design whose sketch is native on both sides.
- [stringify-sorted-canonical](./stringify-sorted-canonical.md) — the key-order
  question phase 4 meets at every comparison site.
- [streaming-recognizer](./streaming-recognizer.md) — the cost profile of this
  module's own pipeline (O(n) value, O(token) buffering); relevant if a
  migrated proof turns out to be slow.
