# 190. `fs/text`: own the single code-unit/code-point ↔ string boundary

Converting between a single character-code number and a one-character JS `string`
is a `fs/text` concern, but four modules reach into the `String` built-in
directly and three of them re-bind the same function under a local name:

```ts
// fs/html/module.f.ts:16
const { fromCharCode } = String

// fs/fsc/module.f.ts:19
const fromCharCode = String.fromCharCode

// fs/js/tokenizer/module.f.ts:73
const { fromCharCode } = String

// fs/text/utf16/module.f.ts:401  — used inline
export const listToString: (input: List<U16>) => string
    = fn(map(String.fromCharCode)) /* … */

// fs/bnf/module.f.ts:71
const { fromCodePoint } = String
```

And the inverse — index a string for a code unit / code point — is likewise
split:

```ts
// fs/text/ascii/module.f.ts:10
const r = s.codePointAt(i)
if (r === void 0) { throw s }

// fs/text/utf16/module.f.ts:359
const first = s.charCodeAt(i)
return isNaN(first) ? empty : { first, tail: () => at(i + 1) }
```

`fs/text/utf16` already owns the *list*-level boundary (`stringToList`,
`stringToCodePointList`, `listToString`, `codePointListToString`). What is missing
is the *single-character* primitive, so every tokenizer/serializer re-binds
`String.fromCharCode`/`fromCodePoint` itself. `AGENTS.md` explicitly discourages
reaching into built-ins from `.f.ts` modules and asks that conceptually-distinct
logic live in its natural module.

## Proposed abstraction

Expose single-character converters from the `fs/text` layer (next to the existing
list converters), e.g.:

```ts
// fs/text (or fs/text/utf16)
export const charFromCode:   (code: U16)       => string   // String.fromCharCode
export const charFromCodePoint: (cp: CodePoint) => string  // String.fromCodePoint
```

Then `html`, `fsc`, `js/tokenizer`, and `bnf` import these instead of re-binding
`String.*`, and `utf16.listToString` builds on `charFromCode`. The two string
*readers* (`ascii`'s throwing `codePointAt` and `utf16`'s lazy `charCodeAt`
stream) can likewise be named in `fs/text` so the JS-string boundary lives in one
namespace.

## Why this qualifies

- The plain `fromCharCode` re-binding has three consumers (`html`, `fsc`,
  `js/tokenizer`) plus the inline `utf16` use — the same "re-bound under a local
  name in module after module" smell that [i167](./README.md) flags for
  `bit_vec.listToVec(msb)`.
- Separation of concerns: code ↔ string conversion is the defining job of
  `fs/text`; scanners and serializers should consume it, not re-import `String`.

## Caveats

- These are thin wrappers over a built-in, so the value is *centralizing the
  boundary and removing scattered `String` references*, not algorithmic reuse —
  weigh that against the project's "don't add a layer no one needs" rule. The
  three-plus consumers and the existing `fs/text` boundary make the case.
- The two *readers* genuinely differ (one indexes by code point and throws for a
  constant-string lookup; the other streams code units lazily and ends on
  `NaN`). They share a concept, not an algorithm, so frame the reader half as
  separation-of-concerns, not a single parameterized factory.
- Keep `fs/text` free of cyclic deps: `ascii`, `bnf`, `fsc`, `js/tokenizer`, and
  `html` already sit above the text layer, so importing downward is clean.

## Related

- [i167](./README.md) — re-binding a shared helper under per-module names.
- [i168](./README.md) — the utf8/utf16 *decoder* skeleton (a different, list-level
  duplication; this issue is the single-character boundary).
