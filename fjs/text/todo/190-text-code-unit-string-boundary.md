## 190. `fjs/text`: own the single code-unit/code-point ↔ string boundary

**Priority:** P3
**Status:** open

Converting between a single character-code number and a one-character JS `string`
is a `fjs/text` concern. Half of it has an owner: `codePointToString` in
[`fjs/text/utf16`](../utf16/module.f.mjs), the scalar counterpart of
`codePointListToString`, which `fjs/media/json/serializer` and
`fjs/fsc/serializer` already use. The code-unit half has none, so modules
reach into the `String` built-in directly:

```ts
// fjs/media/json/parser, fjs/media/json/serializer and fjs/media/html,
// each at module scope
const { fromCharCode } = String

// fjs/text/utf16/module.f.mjs, listToString — used inline
export const listToString = compose(map(String.fromCharCode))(concat)

// fjs/ebnf/ll1/proof.f.mjs — used inline, where `codePointToString` would do
String.fromCodePoint(node.symbol)
```

`fjs/git/store` and `fjs/website` call `String.fromCharCode` inline too.

And the inverse — index a string for a code unit / code point — is likewise
split:

```ts
// fjs/text/ascii/module.f.mjs, at
const r = s.codePointAt(i)
if (r === void 0) { throw s }

// fjs/text/utf16/module.f.mjs, stringToList
const first = s.charCodeAt(i)
```

A concrete casualty of the missing primitive: `fjs/text/sgr/module.f.mjs`
re-declares the backspace control character as a string literal
(`export const backspace = '\x08'`) even though `fjs/text/ascii/module.f.mjs`
already owns the code (`export const backspace = one('\b')`) — `sgr` cannot
say `charFromCode(ascii.backspace)` today, so the byte is defined in two
modules that must stay in sync by hand. Migrate this site when the converter
lands (it also interacts with `fjs/text/sgr/todo/inplace-writer-split.md`,
which relocates the backspace-based writer).

`fjs/text/utf16` already owns the *list*-level boundary (`stringToList`,
`stringToCodePointList`, `listToString`, `codePointListToString`) and the
single code point (`codePointToString`). What is missing is the single *code
unit*, so each serializer re-binds `String.fromCharCode` itself. `AGENTS.md`
explicitly discourages reaching into built-ins from `.f.mjs` modules and asks
that conceptually-distinct logic live in its natural module.

### Proposed abstraction

Expose the code-unit converter from `fjs/text/utf16`, next to
`codePointToString`, e.g.:

```ts
export const charFromCode: (code: U16) => string   // String.fromCharCode
```

Then `media/json/parser`, `media/json/serializer` and `media/html` import it
instead of re-binding `String.*`, `utf16.listToString` builds on
`charFromCode`, and `ebnf/ll1`'s proof calls `codePointToString`. The two string
*readers* (`ascii`'s throwing `codePointAt` and `utf16`'s lazy `charCodeAt`
stream) can likewise be named in `fjs/text` so the JS-string boundary lives in one
namespace.

### Why this qualifies

- The plain `fromCharCode` re-binding has three consumers (`media/json/parser`,
  `media/json/serializer`, `media/html`) plus the inline uses — the same
  "re-bound under a local
  name in module after module" smell that [i167](../../types/bit_vec/module.f.mjs) flags for
  `bit_vec.listToVec(msb)`.
- Separation of concerns: code ↔ string conversion is the defining job of
  `fjs/text`; scanners and serializers should consume it, not re-import `String`.

### Caveats

- These are thin wrappers over a built-in, so the value is *centralizing the
  boundary and removing scattered `String` references*, not algorithmic reuse —
  weigh that against the project's "don't add a layer no one needs" rule. The
  several consumers and the existing `fjs/text` boundary make the case.
- The two *readers* genuinely differ (one indexes by code point and throws for a
  constant-string lookup; the other streams code units lazily and ends on
  `NaN`). They share a concept, not an algorithm, so frame the reader half as
  separation-of-concerns, not a single parameterized factory.
- Keep `fjs/text` free of cyclic deps: `ascii`, `ebnf`, `fsc`, `js/tokenizer`,
  `media/json` and `html` already sit above the text layer, so importing
  downward is clean.

### Related

- [i167](../../types/bit_vec/module.f.mjs) — re-binding a shared helper under
  per-module names; shipped, the per-module `listToVec(msb)` binds dropped for
  the shared `msb.listToVec`.
- [i168](../code_point/README.md#the-streaming-decoder-skeleton) — the
  utf8/utf16 *decoder* skeleton, shipped as `decoder` in
  `fjs/text/code_point/module.f.mjs` (a different, list-level duplication; this
  issue is the single-character boundary).
