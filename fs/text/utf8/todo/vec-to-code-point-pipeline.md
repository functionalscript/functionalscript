## vec-to-code-point-pipeline. Single owner for the UTF-8 `Vec` → string decode pipeline

**Priority:** P4
**Status:** open

### Problem

The "decode an MSB-first UTF-8 `Vec` to a string" pipeline is spelled out
independently in two modules, once unchecked and once checked, with no shared
helper:

```ts
// fs/text/module.f.ts:61-62 — unchecked, top module reaching into three modules
export const utf8ToString = (msbV: Utf8): string =>
    codePointListToString(toCodePointList(u8List(msb)(msbV)))

// fs/text/utf8/module.f.ts:283-290 — checked / Nullable, in the utf8 module
export const fromVec = (v: Vec): string | null => {
    if ((length(v) & 0b111n) !== 0n) { return null }
    const arr = toArray(toCodePointList(u8List(msb)(v)))
    for (const cp of arr) {
        if (!isValidCodePoint(cp)) { return null }
    }
    return codePointListToString(arr)
}
```

Both hardcode the same core chain — `u8List(msb)` bit-unpack →
`toCodePointList` utf8-decode → `codePointListToString` utf16 re-string —
and `fromVec` merely wraps it with an octet-alignment check and an
`isValidCodePoint` filter. `fs/media/module.f.ts:48-50` even documents that
its own detector re-proves "the same two conditions `fromVec` checks, via the
same decoder" — evidence the pipeline is being re-derived in several places.
The unchecked and checked forms also live in *different* modules (top `text`
vs `text/utf8`), so the `Vec` → string UTF-8 boundary has no single owner.
Both are real consumers: `utf8ToString` is used by `effects/node`, `djs`,
`ci`; `fromVec` by `cas/mcp`, `media`.

### Proposal

Give the utf8 module sole ownership of the `Vec` → code-point decode and
express both string forms through it:

```ts
// fs/text/utf8/module.f.ts
export const vecToCodePointList = (v: Vec): List<I32> => toCodePointList(u8List(msb)(v))
```

`fromVec` builds on it (adding its alignment/validity checks), and
`text/module.f.ts`'s `utf8ToString` becomes
`codePointListToString(vecToCodePointList(msbV))`. Consider going further and
moving `utf8ToString` into `fs/text/utf8/module.f.ts` as the unchecked
sibling of `fromVec` (re-exported from `fs/text/module.f.ts` for existing
importers, or migrated as a breaking change) — mirroring how the encode
direction already pairs `tryUtf8`/`utf8` in one place.

### Tasks

- [ ] Add `vecToCodePointList` to `fs/text/utf8/module.f.ts`; rewrite
      `fromVec` and `utf8ToString` through it.
- [ ] Decide whether `utf8ToString` moves next to `fromVec`; update importers
      if so.
- [ ] `npx tsc`, `fjs t`.

### Related

- [../../todo/190.md](../../todo/190.md) — single-character
  `String.fromCharCode`/`codePointAt` boundary; this is the whole-`Vec`
  pipeline, a different layer.
- `fs/media/module.f.ts:46-50` — the detector's documented re-proof of
  `fromVec`'s checks; a cleaner shared decode API may simplify it.
