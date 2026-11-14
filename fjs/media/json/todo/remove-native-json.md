## remove-native-json. Get rid of `JSON.stringify`

**Priority:** P3
**Status:** open

### Problem

`fjs/media/json` owns a complete JSON pipeline written in FunctionalScript —
`tokenize` → `parse` for reading, `serialize` / `stringify` for writing. The
reading half is done: `parseNative` is gone and every call site goes through
the total, `Result`-returning `parse`. Some write sites still call
`JSON.stringify` directly. The shared serializer no longer does:
`numberSerialize` uses the admitted `String` builtin for finite numbers,
preserves `-0` explicitly, and writes non-finite numbers as `null`.
`fjs/media/datajs/serializer` shares its finite-number spelling while keeping
DataJS's separate non-finite spellings. Both serializer leaves are now
FunctionalScript, and the compiler accepts the serializer as `.f.js`.

Three reasons to finish the job:

1. **Two shapes for one concept.** [DESIGN.md §2](../../../../doc/DESIGN.md#2-the-api-is-the-most-important-part-of-quality) treats keeping an old API
   next to the new one as a last resort — "in practice, the old one never
   leaves." That is what happened on the reading side until `parseNative` was
   deleted, and it is what the write side still looks like.
2. **`JSON` is a host global with no FunctionalScript definition.** Nothing in
   `fjs/` defines it and NaNVM (`nanvm/lib/src`) has no `JSON` object, so a
   `.f.mjs` module reaching for it depends on the JS host rather than on
   FunctionalScript. The remaining callers can use the shared serializer.
3. **Pretty output still needs a shared implementation.** The CI writer asks
   native JSON for indentation, which the FunctionalScript serializer does
   not yet provide.

#### `JSON.stringify` in six shapes

The modules below are representative, not a census; re-run the search when a
phase starts.

| Shape | Where | Replacement |
| --- | --- | --- |
| Leaf serializer | done: `fjs/media/json/serializer`'s `numberSerialize` | `String` for finite numbers, explicit `-0`, and `null` for non-finite numbers |
| Expected-output comparison | the proofs of `fjs/rtti/data`, `fjs/rtti/ts`, `fjs/text/code_point`; `fjs/media/revision` and `fjs/media/lock` build test input with it | structural assertions for value comparisons, or `stringify(identity)` for JSON text; the JSON serializer proofs now use structural assertions |
| Assertion messages | `fjs/rtti/ts`'s proof; `fjs/media/datajs/vectors` and its `matrix` quote values in their reports | pass the value, or `fjs/compiler`'s `_stringifyTree` |
| Source-text quoting | done: `fjs/types/ts`, `fjs/emergent_testing` and `fjs/ci/package` | `fjs/js/string_escape`'s `stringLiteral`, which `stringSerialize` also wraps |
| JSON line framing | `fjs/emergent_testing/proof.f.mjs`'s `writeEvent`, `fjs/mcp/proof.f.mjs`; done: `fjs/ci/package`'s `tsconfig.json` line | `stringify(identity)` |
| Pretty-printed file output | `fjs/ci/module.f.mjs`'s `workflowText` | needs indentation support, which `serialize` does not have |

Three semantic differences to respect while migrating, none of them blocking:

- **Key order.** `stringifySorted` sorts keys; native uses insertion order. Use
  `stringify(identity)` where an expected literal encodes native order, or
  re-sort the literal where order-independence is what the test wants.
- **`undefined` and `bigint`.** Native drops `undefined` object fields, turns
  them into `null` inside arrays, and throws on `bigint`. `serialize` takes
  `Unknown`, which excludes `undefined` outright, and `definedEntries` does the
  dropping — so `fjs/protocol/mcp/stdio/proof.f.mjs`'s omission test keeps
  its meaning. `bigint` values (token payloads, for one) need `fjs/compiler`'s
  `_stringifyTree`, which already handles them.
- **Types.** `serialize` demands `Unknown`; the proof sites pass domain types
  (`dm`, `mr`, `emptyTags`). Confirm each is structurally assignable rather
  than reaching for `as` — where it isn't, that is a finding about the domain
  type, not a reason to keep native.

### Proposal

Four phases. They are separable and each is a complete change on its own, so
they should ship as separate PRs
([AGENTS.md §5](../../../../AGENTS.md#5-pull-requests-and-releases)); phases 1
and 2 are complete.

**1. `stringSerialize` in FunctionalScript — done in
[#1438](https://github.com/functionalscript/functionalscript/pull/1438).**
Escapes `"`, `\`, the short
forms `\b \f \n \r \t`, and every other code point below `0x20` as `\u00XX`,
over `fjs/text/utf16`; lone surrogates come out as `\ud800` the way well-formed
`JSON.stringify` (ES2019) emits them, because `stringToCodePointList` already
tags them with `errorMask`. Verified against the host over every code unit and
every surrogate pair, and the proof pins the host's literals so a divergence
fails a test.

Two things that fell out of it, worth knowing before phase 2:

- `fjs/text/utf16` gained `codePointToString`, the scalar counterpart of
  `codePointListToString`. Wrapping one code point in a list to call the list
  version cost about half of the escape loop's time.
- A FunctionalScript leaf is roughly 5× the host's on a serialize-heavy
  benchmark (a 20k-key object: about 130 ms → about 700 ms end to end), which is what
  replacing a C++ builtin with an interpreted decode pipeline costs. That is
  the price of self-hosting, not a defect; if it ever becomes a real problem the
  generic fix is a faster `text/utf16` scan, not a special case in the
  serializer.

**2. `numberSerialize` in FunctionalScript — done.** For a finite number,
`String(x)` supplies the same ECMAScript shortest-round-trip decimal spelling
as `JSON.stringify(x)`, with the serializer's existing explicit `-0` override.
The finite check keeps `NaN` and `±Infinity` on the existing `null` path,
rather than exposing `String`'s non-finite words. Boundary proofs cover
decimal/exponent cutoffs, precision and finite range endpoints. This uses an
admitted builtin; no new number-formatting algorithm is needed for this JSON
migration.

**3. Migrate the remaining write sites** by the shape table above.
The source-text-quoting row is done: `fjs/js/string_escape`'s
`stringLiteral` is the one quoting writer, and a new quoting site goes
through it. The assertion-message row is the cheapest:
[`fjs/AGENTS.md` §1.5](../../../AGENTS.md#15-never-use-trycatch-test-throwing-with-the-throw-key)
says a thrown payload is read only by a human after something already went
wrong, so most of those sites can pass the value itself — but note that the
reporter in `fjs/emergent_testing/module.f.js` renders a failure payload with
`String(v)`, so passing a raw object degrades the message. Either serialize with `fjs/compiler`'s `_stringifyTree` (it handles the
`bigint` token payloads) or improve the reporter's rendering first.

**4. Indentation for `fjs/ci/module.f.mjs`'s `workflowText`**, the only site asking for
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

- [x] Phase 1: FunctionalScript `stringSerialize`, with proof coverage for
      every escape class including lone surrogates.
- [x] Phase 2: replace native JSON number formatting with the admitted `String`
      builtin, preserving explicit `-0` and the non-finite `null` policy.
- [ ] Phase 3: migrate the write sites, row by row from the shape table.
- [ ] Phase 4: indenting serializer; migrate `fjs/ci/module.f.mjs`.
- [ ] Per phase: `tsc`, `fjs t`, `npm start cov node`, and an explanation of the
      behavior changes in the phase's PR. A `Changelog:` section is optional
      before 1.0. The [release policy after 1.0](../../../../todo/post-1.0-release-policy.md) remains undecided.

### Related

- [`fjs/media/json/serializer/module.f.js`](../serializer/module.f.js) — the
  compiler-accepted serializer; phases 1 and 2 are complete.
- [`fjs/text/utf16/module.f.js`](../../../text/utf16/module.f.js) — where the
  escaping reads code points, and where phase 1 added `codePointToString`.
- [`fjs/js/string_escape/module.f.js`](../../../js/string_escape/module.f.js)
  — `stringLiteral`, the escaping `stringSerialize` wraps and the
  source-text-quoting row's replacement.
- [`fjs/types/object/structurally_same/README.md`](../../../types/object/structurally_same/README.md)
  — done: `fjs/cas/evo/proof.f.mjs` stringified two values only to compare
  them, and now uses `assertStructurallySame`, as do the `fjs/js/tokenizer`
  and `fjs/compiler/tokenizer` proofs, which compared a serialized token
  stream against a JSON *string literal*.
- [`fjs/effects/node/todo/readjsonfile-writejsonfile-helpers.md`](../../../effects/node/todo/readjsonfile-writejsonfile-helpers.md)
  — an on-hold design whose `writeJsonFile` half waits on phase 4.
- `stringifySorted` in [`../module.f.mjs`](../module.f.mjs) — the canonical,
  key-sorted serializer, for the key-order question phase 3 meets at every
  comparison site.
- `parse`'s per-container call-stack cost was found while migrating the reading
  sites — it panicked past ~5000 containers, which is why one proof compares a
  serialized dump as text rather than round-tripping it. Fixed in
  [#1435](https://github.com/functionalscript/functionalscript/pull/1435); the
  dump round-trip is available again if that proof is ever revisited.
- [streaming-recognizer](./streaming-recognizer.md) — the cost profile of this
  module's own pipeline (O(n) value, O(token) buffering); relevant if a
  migrated proof turns out to be slow.
