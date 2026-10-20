## 190. `fjs/text`: own the string-reader half of the code ↔ string boundary

**Priority:** P3
**Status:** open

Converting between a single character-code number and a one-character JS
`string` is a `fjs/text` concern. The *writer* half has one owner now:
[`fjs/text/utf16`](../utf16/module.f.mjs) exports `codeUnitToString` next to
`codePointToString`, `listToString` is built on it, and `media/json/parser`,
`media/html`, `js/string_escape`, `text/percent`, `git/alternates`,
`ebnf/railroad` and the `ebnf/ll1` proof import those instead of calling
`String.fromCharCode` / `String.fromCodePoint` themselves.

What remains is the inverse — index a string for a code unit / code point —
which is still split between two modules, each reaching into the `String`
built-in directly:

```ts
// fjs/text/ascii/module.f.js, at
const r = s.codePointAt(i)
if (r === void 0) { throw s }

// fjs/text/utf16/module.f.mjs, stringToList (and floorCodePointBoundary)
const first = s.charCodeAt(i)
```

### Proposed change

Name the two string *readers* in `fjs/text` so the JS-string boundary lives in
one namespace, as the writers now do. `ascii`'s throwing `at` is the candidate
to move or re-export beside `utf16`'s readers.

### Caveats

- The two readers genuinely differ (one indexes by code point and throws for a
  constant-string lookup; the other streams code units lazily and ends on
  `NaN`). They share a concept, not an algorithm, so frame this as
  separation-of-concerns, not a single parameterized factory.
- These are thin wrappers over a built-in; the value is centralizing the
  boundary, not algorithmic reuse — weigh that against the project's "don't
  add a layer no one needs" rule.
- Keep `fjs/text` free of cyclic deps: `ascii`, `ebnf`, `compiler`,
  `js/tokenizer`, `media/json` and `html` already sit above the text layer, so
  importing downward is clean.

### Out of scope

`String.fromCharCode(...bytes)` in `fjs/website/github-runtime.mjs` (and its
proof) spreads a whole byte array into `btoa` in host runtime code, not a
single code unit in a `.f.mjs` module; proofs that build fixtures with
`String.fromCharCode` / `String.fromCodePoint` are test scaffolding.

### Related

- [i167](../../types/bit_vec/module.f.mjs) — re-binding a shared helper under
  per-module names; shipped, the per-module `listToVec(msb)` binds dropped for
  the shared `msb.listToVec`.
- [i168](../code_point/README.md#the-streaming-decoder-skeleton) — the
  utf8/utf16 *decoder* skeleton, shipped as `decoder` in
  `fjs/text/code_point/module.f.mjs` (a different, list-level duplication; this
  issue is the single-character boundary).
