## lead-byte-classifier-dedup. `utf8ByteToCodePointOp` repeats the byte classifier

**Priority:** P4
**Status:** open

### Problem

`utf8ByteToCodePointOp` (`fs/text/utf8/module.f.ts:184-227`) contains the
same three-way byte classifier twice — once for the fresh-state dispatch and
once for error recovery after a bad continuation byte:

```ts
// state === null (:188-192)
if (byte < contTag) return [[byte], null]
if (byte >= 0b1100_0010 && byte <= 0b1111_0100) return [[], [byte]]
return [[byte | errorMask], null]

// recovery after utf8StateToError (:223-226)
const error = utf8StateToError(state)
if (byte < contTag) return [[error, byte], null]
if (byte >= 0b1100_0010 && byte <= 0b1111_0100) return [[error], [byte]]
return [[error, byte | errorMask], null]
```

The two blocks differ only in whether `error` is prepended to the emitted
list. The valid-lead-byte range bounds `0b1100_0010`/`0b1111_0100` are
un-named magic literals repeated at `:190` and `:225` — the same smell the
tag/mask-constant extraction (PR #1020) removed for `contTag`/`lead2Tag`/…,
which did not touch these bounds or this duplicated dispatch.

### Proposal

Hoist named bounds and a classifier next to `contByte`/`contPayload`:

```ts
const leadMin = 0b1100_0010
const leadMax = 0b1111_0100
const isLeadByte = (b: number): boolean => b >= leadMin && b <= leadMax
```

and write the dispatch once, parameterized by the emitted prefix:

```ts
const restart = (prefix: readonly I32[]) => (byte: number): readonly [readonly I32[], Utf8State] =>
    byte < contTag ? [[...prefix, byte], null]
    : isLeadByte(byte) ? [[...prefix], [byte]]
    : [[...prefix, byte | errorMask], null]
```

called as `restart([])(byte)` from the `state === null` arm and
`restart([utf8StateToError(state)])(byte)` from the recovery arm. One
dispatch, one copy of the RFC 3629 lead-byte bounds. This follows the
AGENTS.md rule: the shared structure appears once, only the difference (the
prefix) lives at the call sites.

### Tasks

- [ ] Add `leadMin`/`leadMax`/`isLeadByte` and the shared dispatch helper;
      rewrite both arms of `utf8ByteToCodePointOp`.
- [ ] `npx tsc`, `fjs t`; `fs/text/utf8/proof.f.ts` must pass unchanged
      (this is a pure refactor — byte-identical behavior).

### Related

- CHANGELOG PR #1020 — extracted the tag/payload-mask constants; this
  finishes the job for the lead-byte range and the duplicated dispatch.
- [error-tag-layout-constants](./error-tag-layout-constants.md) — the
  neighboring implicit-contract cleanup.
