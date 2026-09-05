## vec-to-code-point-pipeline. Single owner for the UTF-8 `Vec` → string decode pipeline

**Priority:** P4
**Status:** open

### Problem

The "decode an MSB-first UTF-8 `Vec` to a string" pipeline is spelled out
independently in two modules, once unchecked and once checked, with no shared
helper:

```ts
// fjs/text/module.f.mjs:70-71 — unchecked, top module reaching into three modules
export const utf8ToString = msbV =>
    codePointListToString(toCodePointList(u8List(msb)(msbV)))

// fjs/text/utf8/module.f.mjs:293-300 — checked / Nullable, in the utf8 module
export const fromVec = v => {
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
`isValidCodePoint` filter. `fjs/media/module.f.mjs:142-145` even documents that
its own detector re-proves "the same two conditions `fromVec` checks, via the
same decoder" — evidence the pipeline is being re-derived in several places.

The byte-list level below the `Vec` has the same fan-out, outside `text/`:

```ts
// fjs/web/module.f.mjs:71 — tryUtf8's inner pipeline, re-derived
const utf8Bytes = s => toArray(fromCodePointList(stringToCodePointList(s)))
// fjs/web/module.f.mjs:77-83 — fromVec minus the alignment check, over bytes
const utf8String = bytes => { /* toCodePointList + isValidCodePoint loop + codePointListToString */ }
// fjs/effects/common/module.f.mjs:174-175 — utf8ToString's inner pipeline
const utf8ListToString = bytes => codePointListToString(toCodePointList(bytes))
```

Both modules import the low-level `utf8`/`utf16` primitives directly while
*also* importing `fjs/text`'s wrapper — reaching past the module whose
stated job this is. `fjs/effects/node/module.f.mjs:27-29` still imports
`toCodePointList`, `codePointListToString` and `reverse` and uses none of
them: the residue of this block having been copied out of `effects/node`
into `effects/common`.
The unchecked and checked forms also live in *different* modules (top `text`
vs `text/utf8`), so the `Vec` → string UTF-8 boundary has no single owner.
Both are real consumers: `utf8ToString` is used by `effects/node`, `djs`,
`ci`; `fromVec` by `cas/mcp`, `media`.

### Proposal

Give the utf8 module sole ownership of the `Vec` → code-point decode and
express both string forms through it:

```ts
// fjs/text/utf8/module.f.mjs
export const vecToCodePointList = (v: Vec): List<I32> => toCodePointList(u8List(msb)(v))
```

`fromVec` builds on it (adding its alignment/validity checks), and
`text/module.f.mjs`'s `utf8ToString` becomes
`codePointListToString(vecToCodePointList(msbV))`. Consider going further and
moving `utf8ToString` into `fjs/text/utf8/module.f.mjs` as the unchecked
sibling of `fromVec` — mirroring how the encode direction already pairs
`tryUtf8`/`utf8` in one place. If it moves, migrate it as a breaking change
with every importer updated in the same PR; a re-export left in
`fjs/text/module.f.mjs` for existing importers is the stale-re-export case
`changelog/README.md` rules out.

### Tasks

- [ ] Add `vecToCodePointList` to `fjs/text/utf8/module.f.mjs`; rewrite
      `fromVec` and `utf8ToString` through it.
- [ ] Decide whether `utf8ToString` moves next to `fromVec`; update importers
      if so.
- [ ] Export the byte-list pair too (unchecked and code-point-validated
      forms, beside `fromVec`); replace `fjs/web`'s `utf8Bytes`/`utf8String`
      and `fjs/effects/common`'s `utf8ListToString` with it, so those
      modules stop importing the utf8/utf16 primitives directly.
- [ ] Drop the three unused imports at `fjs/effects/node/module.f.mjs:27-29`.
- [ ] `tsc`, `fjs t`.

### Related

- [../../todo/190-text-code-unit-string-boundary.md](../../todo/190-text-code-unit-string-boundary.md) — single-character
  `String.fromCharCode`/`codePointAt` boundary; this is the whole-`Vec`
  pipeline, a different layer.
- `fjs/media/module.f.mjs:138-145` — the detector's documented re-proof of
  `fromVec`'s checks; a cleaner shared decode API may simplify it.
