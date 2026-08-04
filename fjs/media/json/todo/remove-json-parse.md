## remove-json-parse. Get rid of `JSON.parse`

**Priority:** P3
**Status:** open

### Problem

The repository has two ways to turn JSON text into a value: this module's own
`parse` (`text → Result<Unknown, string>`, total, built on the repo's tokenizer
and parser) and `parseNative`, which is the host's `JSON.parse` re-exported and
throws. Every consumer takes the second one.

Four reasons to remove it:

1. **Two shapes for one concept.** `AGENTS.md` §5.2 treats keeping an old API
   next to the new one as a last resort — "in practice, the old one never
   leaves." That is exactly what happened: `parse` landed, and all 21 call
   sites still use the native path.
2. **It throws.** A `throw` in FunctionalScript is a panic (§3.4): nothing can
   catch it, so a malformed input reaching `parseNative` kills the program with
   no recoverable failure value. `parse` returns a `Result` the caller
   destructures.
3. **It returns `any`, which invites `as`.** `JSON.parse` is typed `any` at
   every call site, so consumers hand-write a shape and assert it —
   `fjs/mcp/proof.f.ts` alone carries 17 `as CasGetResult` casts over a
   hand-written type that no schema backs (§6.2 "avoid `as`").
4. **`JSON` is a host global with no FunctionalScript definition.** Nothing in
   `fjs/` defines it and NaNVM (`nanvm-lib/src`) has no `JSON` object, so a
   `.f.ts` module reaching for it depends on the JS host rather than on
   FunctionalScript. The module's own tokenizer/parser pipeline is the
   definition the language actually owns.

Nothing in production code parses JSON natively — every site is a proof, plus
the export itself:

| Site | Count | Shape |
| --- | --- | --- |
| `fjs/media/json/module.f.ts:143` | 1 | the `parseNative` export |
| `fjs/media/json/proof.f.ts:79-80` | 1 | its coverage test |
| `fjs/mcp/proof.f.ts` | 17 | `JSON.parse(textOf(resp)) as CasGetResult`, plus one `stdout` line split at `:131` |
| `fjs/mcp/evo/proof.f.ts:61` | 1 | `JSON.parse(textOf(result)) as readonly string[]` |
| `fjs/ci/proof.f.ts:11,49` | 1 | `parseNative as jsonParse`, fed to `parseGitHubAction` |
| `fjs/emergent_testing/proof.f.ts:24-25` | 1 | one `Event` per stdout line |
| `fjs/djs/tokenizer/proof.f.ts:938` | 1 | `parsed.length` on a tokenizer dump |

### Proposal

Replace every site, then delete `parseNative` — a breaking change to a
published export, so the CHANGELOG entry is prefixed `**BREAKING CHANGES:**`
(§8.4) and the module JSDoc header loses its `parse` / `parseNative` split.

The mechanical replacement is `unwrap(parse(text))` (`unwrap` from
`fjs/types/result/module.f.ts`), which keeps the "input is known valid, a
failure is a bug" contract in a proof while making the failure a `Result` the
runner reports rather than an unlabeled host exception.

Where the old code carried an `as`, the replacement is a schema instead — the
two-step `text → Unknown → T` this module was designed for:

```ts
// fjs/mcp/proof.f.ts — schema replaces the hand-written type and 17 casts
import { number, option, string } from '../types/rtti/module.f.ts'
import { parse as rttiParse } from '../types/rtti/parse/module.f.ts'
import type { Ts } from '../types/rtti/ts/module.f.ts'

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

Two sites need a decision rather than a substitution:

- **`fjs/emergent_testing/proof.f.ts`** parses each line into `Event`, a tagged
  tuple union whose payload includes `SandboxResult<unknown>`. Either write the
  rtti schema for `Event` and derive the type from it (consistent with the rest
  of this change, and the union is small), or drop the round-trip and assert on
  the emitted lines as text. Pick one before touching the file.
- **`fjs/djs/tokenizer/proof.f.ts:938`** only reads `parsed.length` off a
  tokenizer dump. Rather than parsing the string back, count the tokens from
  the token list the test already has — no JSON step at all.

Check the two large-input proofs (the 3000-token tokenizer dump above, and the
mcp session stdout) for runtime after the switch: this module's parser
accumulates the whole value and is not native-fast. If one of them gets slow,
that is a data point for `streaming-recognizer.md`, not a reason to keep
`parseNative`.

### Tasks

- [ ] Add the `Event` decision above to this file, then migrate
      `fjs/emergent_testing/proof.f.ts`.
- [ ] Migrate `fjs/mcp/proof.f.ts` (schema + `casGetResultOf`) and
      `fjs/mcp/evo/proof.f.ts`.
- [ ] Migrate `fjs/ci/proof.f.ts` and `fjs/djs/tokenizer/proof.f.ts`.
- [ ] Delete `parseNative`, its proof test, and the `parseNative` mentions in
      the `fjs/media/json/module.f.ts` module header.
- [ ] Update `fjs/effects/node/todo/readjsonfile-writejsonfile-helpers.md`, whose
      sketch still calls `JSON.parse`.
- [ ] `npx tsc`, `fjs t`, `npm run cov` (the deleted export must not leave a
      coverage hole), and a `**BREAKING CHANGES:**` CHANGELOG entry.

### Related

- [`fjs/media/json/module.f.ts`](../module.f.ts) — defines both `parse` and
  `parseNative`; the export this issue removes.
- [`fjs/djs/todo/json-bigint-serialization.md`](../../../djs/todo/json-bigint-serialization.md)
  — cites the `parse` / `parseNative` split as the precedent for its own
  `parseWith` design; that reference should read as history once `parseNative`
  is gone.
- [`fjs/effects/node/todo/readjsonfile-writejsonfile-helpers.md`](../../../effects/node/todo/readjsonfile-writejsonfile-helpers.md)
  — an on-hold design whose `readJsonFile` sketch is `JSON.parse`-based; it
  should read JSON through `parse` when it lands.
- [streaming-recognizer](./streaming-recognizer.md) — the cost profile of this
  module's own pipeline (O(n) value, O(token) buffering); relevant only if a
  migrated proof turns out to be slow.
- `JSON.stringify` is a **separate** concern and out of scope here: it is total,
  and `stringify` already exists next to it — see
  [stringify-sorted-canonical](./stringify-sorted-canonical.md).
