## lead-byte-classifier-dedup. Write the fresh/recovery unit classifier once (utf8 and utf16)

**Priority:** P3
**Status:** open

### Problem

`utf8ByteToCodePointOp` (`fs/text/utf8/module.f.ts:190-240`) contains the
same three-way byte classifier twice — once for the fresh-state dispatch and
once for error recovery after a bad continuation byte:

```ts
// state === null (:194-198)
if (byte < contTag) return [[byte], null]
if (byte >= 0b1100_0010 && byte <= 0b1111_0100) return [[], [byte]]
return [[byte | errorMask], null]

// recovery after utf8StateToError (:236-239)
const error = utf8StateToError(state)
if (byte < contTag) return [[error, byte], null]
if (byte >= 0b1100_0010 && byte <= 0b1111_0100) return [[error], [byte]]
return [[error, byte | errorMask], null]
```

The two blocks differ only in whether `error` is prepended to the emitted
list. The valid-lead-byte range bounds `0b1100_0010`/`0b1111_0100` are
un-named magic literals repeated at both sites — the same smell the
tag/mask-constant extraction (PR #1020) removed for `contTag`/`lead2Tag`/…,
which did not touch these bounds or this duplicated dispatch.

This is not utf8-specific. `utf16ByteToCodePointOp`
(`fs/text/utf16/module.f.ts`) has the identical structure with a different
classifier — fresh arm `:194-198` vs recovery arm `:204-206`:

```ts
if (state === null) {
    if (isBmpCodePoint(word)) { return [[word], null] }
    if (isHighSurrogate(word)) { return [[], word] }
    return [[word | errorMask], null]
}
...
if (isBmpCodePoint(word)) { return [[state | errorMask, word], null] }
if (isHighSurrogate(word)) { return [[state | errorMask], word] }
return [[state | errorMask, word | errorMask], null]
```

One algorithm — *"classify a fresh unit, optionally prefixed by a flushed
error"* — appears four times across the two codecs, and each pair must be
kept in lockstep by hand.

### Proposal

Two layers: a shared generic `restart`, and per-codec classifiers used by
both arms.

**Shared.** Put `restart` in `fs/text/code_point/module.f.ts` — the module
both codecs already import for `decoder`/`errorMask`, and the only shared
dependency (utf8 imports from utf16, so a helper in utf8 could not serve
utf16 without a cycle):

```ts
export const restart =
    <Cp, S>(fresh: (u: number) => readonly [List<Cp>, S | null]) =>
    (prefix: readonly Cp[]) =>
    (u: number): readonly [List<Cp>, S | null] => {
        const [emit, s] = fresh(u)
        return [[...prefix, ...emit], s]
    }
```

**utf8.** Hoist named bounds and a classifier next to
`contByte`/`contPayload`, and define the fresh dispatch once:

```ts
const leadMin = 0b1100_0010
const leadMax = 0b1111_0100
const isLeadByte = (b: number): boolean => b >= leadMin && b <= leadMax

const fresh = (byte: number): readonly [List<I32>, Utf8NonEmptyState | null] =>
    byte < contTag ? [[byte], null]
    : isLeadByte(byte) ? [[], [byte]]
    : [[byte | errorMask], null]
```

called as `fresh(byte)` from the `state === null` arm and
`restart(fresh)([utf8StateToError(state)])(byte)` from the recovery arm
(`restart(fresh)([])` reduces to `fresh`, so behavior is byte-identical).
One dispatch, one copy of the RFC 3629 lead-byte bounds.

**utf16.** Same shape with the `isBmpCodePoint`/`isHighSurrogate` classifier
and recovery prefix `[state | errorMask]`.

This follows the AGENTS.md rule: the shared structure appears once, only the
differences (the classifier per codec, the prefix per arm) live at the call
sites.

### Tasks

- [ ] Add `restart` to `fs/text/code_point/module.f.ts` next to `decoder`.
- [ ] utf8: add `leadMin`/`leadMax`/`isLeadByte` and `fresh`; rewrite both
      arms of `utf8ByteToCodePointOp`.
- [ ] utf16: extract its fresh classifier; rewrite both arms of
      `utf16ByteToCodePointOp`.
- [ ] `npx tsc`, `fjs t`; utf8/utf16/code_point proofs must pass unchanged
      (this is a pure refactor — byte-identical behavior).

### Related

- CHANGELOG PR #1020 — extracted the tag/payload-mask constants; this
  finishes the job for the lead-byte range and the duplicated dispatch.
- [error-tag-layout-constants](./error-tag-layout-constants.md) — the
  neighboring implicit-contract cleanup.
- `fs/text/code_point/module.f.ts:33-41` — `decoder` (i168), the existing
  shared half of the streaming skeleton.
- [codec-eof-flush](../../todo/codec-eof-flush.md) — the companion
  end-of-input extraction; together they complete the shared skeleton.
