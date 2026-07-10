## codec-restart-shared. Share the fresh-dispatch/recovery `restart` across utf8 and utf16

**Priority:** P3
**Status:** open

### Problem

Both streaming decoders contain a fresh-state 3-way dispatch (emit a code
point / begin a multi-unit sequence / emit an error-tagged unit) **and** a
byte-identical recovery copy of the same dispatch whose only difference is an
error prefix prepended to the emitted list.

UTF-8 (`fs/text/utf8/module.f.ts`) — null-state arm `:194-198` vs recovery
arm `:236-239`:

```ts
if (state === null) {
    if (byte < contTag) return [[byte], null]
    if (byte >= 0b1100_0010 && byte <= 0b1111_0100) return [[], [byte]]
    return [[byte | errorMask], null]
}
...
const error = utf8StateToError(state)
if (byte < contTag) return [[error, byte], null]
if (byte >= 0b1100_0010 && byte <= 0b1111_0100) return [[error], [byte]]
return [[error, byte | errorMask], null]
```

UTF-16 (`fs/text/utf16/module.f.ts`) — the same shape with a different
classifier, `:194-198` vs `:204-206`:

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
error"* — appears four times across two modules. Each pair must be kept in
lockstep by hand: a change to a codec's classification has to be mirrored
into its recovery twin, with nothing enforcing the match.

### Proposal

Put a generic `restart` in `fs/text/code_point/module.f.ts` — the module both
codecs already import for `decoder`/`errorMask`, and the only shared
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

Each codec then defines its fresh classifier once and uses it in both arms:

```ts
// utf8
const fresh = (byte: number) =>
    byte < contTag ? [[byte], null]
    : byte >= 0b1100_0010 && byte <= 0b1111_0100 ? [[], [byte]]
    : [[byte | errorMask], null]
// null arm:      fresh(byte)
// recovery arm:  restart(fresh)([utf8StateToError(state)])(byte)
```

and analogously for utf16 with the `isBmpCodePoint`/`isHighSurrogate`
classifier and prefix `[state | errorMask]`. `restart(fresh)([])` reduces to
`fresh`, so behavior is byte-identical; each codec's classification then
exists in exactly one place.

This supersedes the utf8-scoped
[lead-byte-classifier-dedup](../utf8/todo/lead-byte-classifier-dedup.md):
that issue proposes the same `restart(prefix)` shape but places it inside
utf8, which cannot serve the identical utf16 duplication (dependency
direction). Implement this cross-codec version and fold that issue into it.

### Tasks

- [ ] Add `restart` to `fs/text/code_point/module.f.ts` next to `decoder`.
- [ ] utf8: extract the fresh classifier; use it for both the null-state and
      recovery arms of `utf8ByteToCodePointOp`.
- [ ] utf16: same for `utf16ByteToCodePointOp`.
- [ ] Reconcile with
      [lead-byte-classifier-dedup](../utf8/todo/lead-byte-classifier-dedup.md)
      (delete or update it in the same PR).
- [ ] `npx tsc` clean; `fjs t` passes (utf8/utf16 proofs).

### Related

- `fs/text/code_point/module.f.ts:33-41` — `decoder`, the existing shared
  half of the streaming skeleton (i168).
- [codec-eof-flush](./codec-eof-flush.md) — the companion eof-step
  extraction; together they complete the shared skeleton.
