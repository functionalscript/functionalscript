## parse-text-pipeline. A Result-returning string→value parse entry point

**Priority:** P3
**Status:** open

### Problem

`fjs/media/json` exposes its pure lexer and parser as two separate modules —
`tokenize` in `fjs/media/json/tokenizer/module.f.ts` and
`parse: (tokenList) => Result<Unknown, string>` in
`fjs/media/json/parser/module.f.ts` — but offers **no** single "parse a string
into a JSON value" entry point built on them. Every consumer that wants to go
from text to a `Result` composes the same three-call pipeline by hand:

```ts
// fjs/media/revision/module.f.ts:110-112
const parseJson = (text: string): Result<Unknown, string> =>
    jsonParse(jsonTokenize(stringToList(text)))

// fjs/dev/package_json/module.f.ts:28-29 — byte-identical body, different name
const parseJsonText = (text: string): Result<Unknown, string> =>
    jsonParse(jsonTokenize(stringToList(text)))

// fjs/protocol/mcp/stdio/module.f.ts:81 — the same composition inlined
const [t, value] = parse(tokenize(stringToList(line)))
```

Two of these are line-for-line identical, so the second-consumer bar is met
and passed. The cause is a naming/separation twist: `fjs/media/json/module.f.ts:121-123`
*does* export a `parse`, but it is native `JSON.parse` — it bypasses the
module's own tokenizer/parser pipeline, returns a raw `Unknown` instead of a
`Result`, and throws on malformed input, contrary to the errors-as-values
convention its own submodules follow. The one export named `parse` is
unusable for consumers that want the pure, total pipeline, which is exactly
why all three re-wire it themselves.

### Proposal

Add a Result-returning string parser to `fjs/media/json/module.f.ts` built on
the module's own pipeline:

```ts
import { parse as parseTokens } from './parser/module.f.ts'
import { tokenize } from './tokenizer/module.f.ts'
import { stringToList } from '../../text/utf16/module.f.ts'

export const parse: (text: string) => Result<Unknown, string> =
    text => parseTokens(tokenize(stringToList(text)))
```

The new entry point takes the name **`parse`**, and the existing
`parse = JSON.parse` becomes `parseNative`. The Problem above is that `parse` is
the concept consumers want and the module spends that name on the export they
all avoid; moving the native one aside only to park the pipeline under a
qualified name like `parseText` would leave the best name unused and keep the
naming compromise in place, which is the trade-off `AGENTS.md` §5.2 rejects.
`parseNative` also reads as what it is — the escape hatch, qualified because it
is the special case. There is no clash with `parser/module.f.ts`'s own `parse`
(over a token list): different module, and this one already imports it as
`parseTokens`.

Then `revision`'s `parseJson`, `package_json`'s `parseJsonText`, and
`mcp/stdio`'s inline call import `parse` and delete their local copies.

This is the strongest form of breaking change — a surviving name with a new
contract — so the CHANGELOG entry must state both shapes: `parse` goes from
`(string) => Unknown` (throwing) to `(string) => Result<Unknown, string>`
(total), and the old behavior is available as `parseNative`. In-repo the type
change is caught by `tsc`, and there is exactly one importer to update:
`fjs/ci/proof.f.ts:11` (`import { parse as jsonParse }`). An untyped external
caller would see the change only at runtime, which is what the entry has to warn
about.

### Tasks

- [ ] Rename `parse = JSON.parse` to `parseNative`; update `fjs/ci/proof.f.ts`.
- [ ] Add the Result-returning `parse` to `fjs/media/json/module.f.ts` with
      proof coverage.
- [ ] Migrate the three consumers; delete their local copies.
- [ ] Ship both renames in one PR with a **BREAKING CHANGES** entry naming the
      old and new shapes of `parse`.
- [ ] `npx tsc`, `fjs t`.

### Related

- [streaming-recognizer.md](./streaming-recognizer.md) — a payload-free
  validity recognizer; the opposite need (no value built), no string entry
  point.
- [../../../effects/node/todo/readjsonfile-writejsonfile-helpers.md](../../../effects/node/todo/readjsonfile-writejsonfile-helpers.md)
  — effects-layer file helper that deliberately uses native `JSON.parse`; a
  different layer.
