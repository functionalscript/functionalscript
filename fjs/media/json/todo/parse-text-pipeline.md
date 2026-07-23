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

// fjs/mcp/stdio/module.f.ts:81 — the same composition inlined
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

export const parseText: (text: string) => Result<Unknown, string> =
    text => parseTokens(tokenize(stringToList(text)))
```

Then `revision`'s `parseJson`, `package_json`'s `parseJsonText`, and
`mcp/stdio`'s inline call import `parseText` and delete their local copies.
Separately, decide what to do about the existing `parse = JSON.parse` export:
its name collides with the concept consumers actually want, and its
throwing/native behavior is the reason they avoid it — rename (e.g.
`parseNative`) as a breaking change with importers updated in the same PR, or
keep and document the split.

### Tasks

- [ ] Add `parseText` to `fjs/media/json/module.f.ts` with proof coverage.
- [ ] Migrate the three consumers; delete their local copies.
- [ ] Decide the fate of the `parse = JSON.parse` export; if renamed, update
      all importers in the same PR (**BREAKING CHANGES** entry).
- [ ] `npx tsc`, `fjs t`.

### Related

- [streaming-recognizer.md](./streaming-recognizer.md) — a payload-free
  validity recognizer; the opposite need (no value built), no string entry
  point.
- [../../../effects/node/todo/readjsonfile-writejsonfile-helpers.md](../../../effects/node/todo/readjsonfile-writejsonfile-helpers.md)
  — effects-layer file helper that deliberately uses native `JSON.parse`; a
  different layer.
