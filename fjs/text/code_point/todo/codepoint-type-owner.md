## codepoint-type-owner. The shared `CodePoint` type has no owner

**Priority:** P3
**Status:** open

### Problem

`fjs/text/code_point` is documented as the shared Unicode code-point contract
for the UTF-8 and UTF-16 codecs — it owns `errorMask`, `decoder`, `eofFlush`,
and the classification predicates — yet it ships no `types.ts`, and the *name*
of the value it operates on lives in two codec-private type modules under two
spellings:

```ts
// fjs/text/utf16/types.ts:22
export type CodePoint = number
// fjs/text/utf8/types.ts:13
export type I32 = number   // "A singed 32-bit integer"
```

Consequences:

- Six modules that have nothing to do with UTF-16 import the generic type from
  the UTF-16 codec: `fjs/djs/tokenizer/module.f.mjs:29`,
  `fjs/bnf/descent/types.ts:7`, `fjs/bnf/descent/proof.f.mjs`,
  `fjs/bnf/ll1/types.ts:7`, `fjs/bnf/ll1/module.f.mjs`,
  `fjs/media/json/serializer/module.f.mjs:17`.
- At the seam the two spellings meet with no named relation:
  `utf8.toCodePointList` is typed `(input: List<U8>) => List<I32>`
  (`fjs/text/utf8/module.f.mjs:259-262`) and its output is handed to
  `codePointListToString`, which takes `List<CodePoint>`
  (`fjs/text/module.f.mjs:62`).
- `code_point`'s own signatures fall back to bare `number`
  (`fjs/text/code_point/module.f.mjs:106`, `:129`, `:153`).

Also found in the same pass: `ByteOrEof` (`fjs/text/utf8/types.ts:20`) is
named in `utf8/module.f.mjs:9`'s `@import` but referenced nowhere — dead.

### Proposal

Create `fjs/text/code_point/types.ts` owning:

- `CodePoint` — a valid code point or an `errorMask`-tagged error value
  (documenting that the error tag is part of the domain; this replaces
  `utf8`'s `I32` name).

Then:

- retype `code_point`'s predicates and `decoder`/`eofFlush` with it;
- `utf16/types.ts` and `utf8/types.ts` re-export or import it, dropping the
  local `CodePoint`/`I32` aliases;
- repoint the six external importers at `text/code_point/types.ts`;
- delete the dead `ByteOrEof`.

### Tasks

- [ ] Add `fjs/text/code_point/types.ts` with `CodePoint` and JSDoc stating
      the error-tag convention.
- [ ] Retype `code_point`, `utf8` (replace `I32`), `utf16`; delete `ByteOrEof`.
- [ ] Repoint the importers in `djs/tokenizer`, `bnf/descent`, `bnf/ll1`,
      `media/json/serializer`.
- [ ] `tsc`, `fjs t`.

### Related

- [190](../../todo/190-text-code-unit-string-boundary.md) — the code-unit/code-point ↔ string *value*
  boundary; this issue is the *type* boundary, complementary.
- `fjs/text/utf8/todo/error-tag-layout-constants.md` — names the error-tag
  bit layout; the new type's JSDoc should link there.
