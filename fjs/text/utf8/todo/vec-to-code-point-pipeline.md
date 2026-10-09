## vec-to-code-point-pipeline. Single owner for the UTF-8 `Vec` → string decode pipeline

**Priority:** P4
**Status:** wip

### Problem

The "decode an MSB-first UTF-8 `Vec` to a string" pipeline is spelled out
independently in two modules, once unchecked and once checked, with no shared
helper:

```ts
// fjs/text/module.f.mjs, utf8ToString — unchecked, top module reaching into three modules
export const utf8ToString = msbV =>
    codePointListToString(toCodePointList(u8ListMsb(msbV)))

// fjs/text/utf8/module.f.mjs, fromVec — checked / Nullable, in the utf8 module
export const fromVec = v => {
    if (!isWholeBytes(v)) { return null }
    const arr = toArray(toCodePointList(u8ListMsb(v)))
    for (const cp of arr) {
        if (!isValidCodePoint(cp)) { return null }
    }
    return codePointListToString(arr)
}
```

Both hardcode the same core chain — `u8ListMsb` bit-unpack →
`toCodePointList` utf8-decode → `codePointListToString` utf16 re-string —
and `fromVec` merely wraps it with an octet-alignment check and an
`isValidCodePoint` filter. `detect` in `fjs/media/module.f.mjs` even documents
that its own detector re-proves "the same two conditions `fromVec` checks, via
the same decoder" — evidence the pipeline is being re-derived in several places.

The byte-list level below the `Vec` had the same fan-out, outside `text/`, in
`fjs/text/percent`, `fjs/git/refstore`, `fjs/media/datajs/parser` and
`fjs/effects/common`, each importing the low-level `utf8`/`utf16` primitives
directly. `text/utf8` now owns that level as `stringToU8List`,
`u8ListToString` and `fromU8List`, and those modules use them.

The unchecked and checked forms also live in *different* modules (top `text`
vs `text/utf8`), so the `Vec` → string UTF-8 boundary has no single owner.
Both are real consumers: `utf8ToString` is used by `effects/node`,
`effects/node/virtual` and `types/uint8array`; `fromVec` by `media`,
`media/datajs/vectors/matrix`, `cas/evo`, `git/repo` and `git/refstore`.

**The names do not say the direction either.** `text/utf8`'s `fromVec`
*decodes* — `Vec` to string — while its `fromCodePointList` *encodes*, code
points to bytes, so `from…` names the input in one and the output's source in
the other; `git/refstore` imports the two side by side. And
`types/uint8array`'s `fromVec` means `Vec` to `Uint8Array`, a third reading
of the same name.

### Proposal

Give the utf8 module sole ownership of the `Vec` → code-point decode and
express both string forms through it:

```ts
// fjs/text/utf8/module.f.mjs
export const vecToCodePointList = (v: Vec): List<CodePoint> => toCodePointList(u8ListMsb(v))
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

**Revised once the byte-list helpers landed.** The byte list is the lower
layer, so the `Vec` forms are now a `u8ListMsb` unpack in front of it:
`fromVec` is `fromU8List` after the alignment check, and `utf8ToString`
is `u8ListToString`. The code-point validation lives once, in
`fromU8List`, and `vecToCodePointList` is left with no caller but its
proof. `git/refstore` still imports `utf16`'s `codePointListToString` for
`nameKey`, which is a byte-per-code-unit key, not a decoding.

### Tasks

- [x] Add `vecToCodePointList` to `fjs/text/utf8/module.f.mjs`; rewrite
      `fromVec` and `utf8ToString` through it.
- [ ] Decide whether `utf8ToString` moves next to `fromVec`; update importers
      if so.
- [ ] Decide whether `vecToCodePointList` is removed, now that nothing calls
      it. Explain the API removal in the PR and update every importer; a
      breaking notice is optional before 1.0 and required from 1.0 onward.
- [x] Export the byte-list helpers in both directions, beside `fromVec`:
      the decoder pair (unchecked and code-point-validated
      `bytes → string`) replaces `fjs/text/percent`'s `utf8String` and
      `fjs/effects/common`'s `utf8ListToString` and the inline decode in
      `fjs/media/datajs/parser`'s `tryParseBytes`; a byte-list encoder
      (`string → bytes`, the inner pipeline of `tryUtf8`) replaces
      `fjs/text/percent`'s `utf8Bytes` and `fjs/git/refstore`'s `nameBytes`.
      Then those modules stop importing the utf8/utf16 primitives directly.
      `stringToU8List` and `u8ListToString` (unchecked) are named after
      `utf16`'s `stringToCodePointList`/`codePointListToString` pair, so each
      says its direction; the validated decoder is the existing `fromU8List`
      (`null` on invalid), whose name joins the renaming task below.
      `fromVec` and `tryUtf8` build on them.
- [ ] Name the UTF-8 boundary in one direction: the decoder and encoder in
      `text/utf8` say which way they go, and `types/uint8array`'s `fromVec`
      stops sharing a name with a decoder. A renamed export changes the public
      API: explain it and update every importer in the same PR. Breaking
      notices are optional before 1.0.
- [x] Drop the two unused imports in `fjs/effects/node/module.f.mjs`.
- [ ] `tsc`, `fjs t`.

### Related

- [../../todo/190-text-code-unit-string-boundary.md](../../todo/190-text-code-unit-string-boundary.md) — single-character
  `String.fromCharCode`/`codePointAt` boundary; this is the whole-`Vec`
  pipeline, a different layer.
- `fjs/media/module.f.mjs`, `detect` — the detector's documented re-proof of
  `fromVec`'s checks; a cleaner shared decode API may simplify it.
