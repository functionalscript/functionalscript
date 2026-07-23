## decoder-oob-sentinel. Out-of-range guard emits a magic `0xffffffff` instead of `errorMask`

**Priority:** P4
**Status:** open

### Problem

The utf8 and utf16 decoders share the `code_point` `errorMask` error
contract, but their *input-domain guards* — the first check each per-unit
step performs when the raw code unit is outside its valid range — disagree on
the sentinel:

```ts
// fjs/text/utf8/module.f.ts:209-212 — uses the shared constant
export const utf8ByteToCodePointOp: StateScan<number, Utf8State, readonly I32[]> = (byte, state) => {
    if (byte < 0x00 || byte > 0xff) {
        return [[errorMask], state]
    }

// fjs/text/utf16/module.f.ts:189-193 — bare magic literal
const utf16ByteToCodePointOp: StateScan<U16, Utf16State, List<CodePoint>>
    = (word, state) => {
        if (!u16(word)) {
            return [[0xffffffff], state]
        }
```

Both guards are structurally identical — "raw unit out of range → emit one
error unit, pass `state` through unchanged" — but utf16 emits a hardcoded
`0xffffffff`: a second, un-named "invalid" sentinel that only *happens* to
have bit 31 set, so downstream error detection still fires. The utf16 JSDoc
even documents the literal ("an error code `0xffffffff` is returned",
`:171`), cementing an accidental value as a contract. Every other error path
in the same function goes through `… | errorMask`.

### Proposal

Make the out-of-range guard obey the shared `code_point` error contract:
emit `[[errorMask], state]`, matching utf8's behavior, and update the JSDoc.
If, after that, centralizing the shape is judged worthwhile (both decoders
would then open with the identical guard body — a real second consumer), add
a small helper next to `decoder` in `fjs/text/code_point/module.f.ts`:

```ts
export const outOfRange = <S>(state: S): readonly [readonly number[], S] => [[errorMask], state]
```

Check `fjs/text/utf16/proof.f.ts` for assertions pinning `0xffffffff` and
update them with the fix.

### Tasks

- [ ] Replace `[[0xffffffff], state]` with `[[errorMask], state]` in
      `utf16ByteToCodePointOp`; fix the JSDoc.
- [ ] Update any proof expectations pinning the old literal.
- [ ] Decide on the shared `outOfRange` helper once both guards are identical.
- [ ] `npx tsc`, `fjs t`.

### Related

- [../todo/666-utf16-encode-errormask.md](../../todo/666-utf16-encode-errormask.md)
  — the *encoder* (`codePointToUtf16`) discarding the error tag; opposite
  direction, same contract. Coordinate ordering.
- [word-classifier-dedup.md](./word-classifier-dedup.md) — the `state === null`
  dispatch *after* this guard; orthogonal.
