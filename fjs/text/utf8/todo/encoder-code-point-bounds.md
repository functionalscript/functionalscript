## encoder-code-point-bounds. `codePointToUtf8` re-spells `code_point`'s boundary constants

**Priority:** P4
**Status:** open

### Problem

`fjs/text/code_point/module.f.mjs:73-75` states its own contract: "Every
predicate below is derived from these constants so the surrogate bounds and
the maximum appear exactly once":

```js
// fjs/text/code_point/module.f.mjs:79-80
const bmpMax = /** @type {const} */ 0xffff
const maxCodePoint = /** @type {const} */ 0x10_ffff
```

The UTF-16 encoder honours that — `codePointToUtf16` dispatches through
`isBmpCodePoint`/`isSupplementaryPlane`. But the UTF-8 encoder imports nothing
from `code_point` except `errorMask` and re-spells both boundaries inline:

```js
// fjs/text/utf8/module.f.mjs:97, :104
if (input >= 0x0800 && input <= 0xffff) { ... }
if (input >= 0x10000 && input <= 0x10ffff) { ... }
```

So the "appears exactly once" invariant is already broken one directory up.

### Proposal

Export `bmpMax` and `maxCodePoint` from `code_point` (or an
`isSupplementaryPlane`-style range predicate where one fits) and write the
3- and 4-byte guards of `codePointToUtf8` through them. The genuinely
UTF-8-specific thresholds (`0x7f`, `0x7ff` — encoding-length boundaries, not
code-point-domain boundaries) stay local.

### Tasks

- [ ] Export the two constants from `fjs/text/code_point/module.f.mjs` with
      proof coverage.
- [ ] Rewrite `codePointToUtf8`'s valid-range guards through them.
- [ ] `npx tsc`, `fjs t` — pure refactor.

### Related

- `fjs/text/utf8/todo/error-tag-layout-constants.md` — covers the *error*
  branch of the same function; this issue covers the valid-range branches.
- `fjs/text/todo/surrogate-pair-in-code-point.md` — the utf16 counterpart of
  moving code-point-domain arithmetic into `code_point`.
