## `utf8ByteToCodePointOp` accepts overlong 3-/4-byte sequences

**Priority:** P2
**Status:** open

### Problem

`fs/text/utf8/module.f.ts`'s `utf8ByteToCodePointOp` is a non-conformant UTF-8
decoder: it accepts **overlong** 3- and 4-byte encodings that the Unicode
standard (Table 3-7, *Well-Formed UTF-8 Byte Sequences*) defines as ill-formed,
emitting the decoded code point instead of an error.

In the `state.length === 1` arm (the first continuation after a lead byte), a
3-/4-byte lead accumulates the continuation **without checking its lower bound**
(`fs/text/utf8/module.f.ts:201`):

```ts
case 1: {
    const [s0] = state
    if (s0 < lead3Tag) {
        return [[((s0 & lead2Mask) << 6) + contPayload(byte)], null]
    }
    if (s0 < 0b1111_1000) return [[], [s0, byte]]   // accepts ANY continuation
    break
}
```

So after lead `E0` any continuation `80..9F` is accepted, and after lead `F0`
any continuation `80..8F` is accepted. These are overlong forms:

- `E0 80 80` decodes to U+0000 (`0xE0 & 0x0F = 0`, payloads `0`), and
  `isValidCodePoint(0)` is `true`.
- `F0 80 80 80` likewise decodes to a small code point that passes.

The decoder already *intends* to reject overlongs — it refuses the `C0`/`C1`
2-byte overlong leads via `byte >= 0b1100_0010` at line 191. It simply misses
the 3-/4-byte cases. This is incomplete, not a deliberate leniency, and it is
security-relevant: overlong encodings are a classic filter-bypass (overlong NUL,
overlong `/`).

### Impact

The defect lives in the shared decoder, so every consumer inherits it:

- `fromVec` (`fs/text/utf8/module.f.ts:265`) validates with the same decoder +
  `isValidCodePoint`, so it reports a blob containing overlong bytes as valid
  UTF-8.
- `fs/mime`'s `detectStream` / `detectVec` ride the same decoder (`utf8Step`),
  so metadata-only `cas_get` classifies a binary blob with overlong bytes as
  `text/plain` instead of the documented `application/octet-stream` fallback.

Because the bug is in `fs/text/utf8`, fixing it once there fixes all consumers
with no duplicated well-formedness logic — the single-source-of-truth reason it
should **not** be patched locally in `fs/mime`.

### Proposal

Reject the overlong first-continuation ranges in `utf8ByteToCodePointOp`'s
`case 1`, routing them to the existing error path (the same one a bad
continuation already takes at lines 224-227) instead of building the next state:

- lead `E0` (`s0 === 0b1110_0000`): require the continuation `>= 0xA0`;
- lead `F0` (`s0 === 0b1111_0000`): require the continuation `>= 0x90`.

A continuation below the bound is an ill-formed lead → emit
`<lead> | errorMask` and re-process `byte` (consistent with the decoder's
maximal-subpart error recovery).

Scope this change to overlongs. The decoder also does not itself reject
surrogates (`ED A0..BF`) or `> U+10FFFF` (`F4 90..BF`) — today only `fromVec`'s
`isValidCodePoint` pass filters those out of the raw code-point stream. Whether
the raw decoder should enforce the full Table 3-7 (surrogates and the upper
bound too) is a broader conformance question; keep it out of this issue unless
deliberately taken on.

### Tasks

- [ ] Reject overlong `E0 80..9F` and `F0 80..8F` first-continuations in
      `utf8ByteToCodePointOp`, emitting the lead as an error and re-processing the
      continuation byte
- [ ] Confirm valid boundaries still decode: `E0 A0 80` → U+0800,
      `F0 90 80 80` → U+10000
- [ ] Add `fs/text/utf8/proof.f.ts` cases for overlong rejection (3- and 4-byte)
      and the valid boundary cases
- [ ] Run the full suite (`fjs t`) — no existing test should encode the
      accept-overlong behavior; `npx tsc` clean
- [ ] After landing, the `fs/mime` `detectStream` / `detectVec` and `fromVec`
      paths classify overlong blobs as non-text with no `fs/mime` change

### Related

- [cas-get-large-files] streaming MIME/UTF-8 detector
  ([`fs/mime`](../../../mime/module.f.ts) `detectStream` / `detectVec`) surfaced
  this; PR [#1181](https://github.com/functionalscript/functionalscript/pull/1181)
- `fs/text/utf8/module.f.ts` — `utf8ByteToCodePointOp`, `fromVec`,
  `isValidCodePoint`
- `fs/text/code_point/module.f.ts` — `errorMask` and the shared `decoder` factory
- [Unicode Table 3-7](https://www.unicode.org/versions/Unicode15.0.0/ch03.pdf#G7404)
  — Well-Formed UTF-8 Byte Sequences
