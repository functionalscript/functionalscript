## codec-eof-flush. Share the end-of-input flush step between utf8 and utf16

**Priority:** P4
**Status:** open

### Problem

The two decoders' end-of-input steps are the same one-liner differing only in
a state→error function.

`fjs/text/utf8/module.f.ts:262-267`:

```ts
export const utf8EofToCodePointOp = (
    state: Utf8State,
): readonly [List<I32>, Utf8State] => [
    state === null ? null : [utf8StateToError(state)],
    null,
]
```

`fjs/text/utf16/module.f.ts:234-235`:

```ts
const utf16EofToCodePointOp = (state: Utf16State): readonly[List<CodePoint>, Utf16State] =>
    [state === null ? empty : [state | errorMask],  null]
```

Both say *"if there is leftover state, flush it as a single error unit, then
reset"*. The only variable is the flush function: `utf8StateToError` vs
`state | errorMask` (`null` and `empty` are both the empty list). The
`code_point.decoder` factory (`fjs/text/code_point/module.f.ts:33-41`, i168)
already unifies the rest of the streaming skeleton; the eof-op is the last
structurally identical per-codec piece left behind.

### Proposal

Add a companion to `decoder` in `fjs/text/code_point/module.f.ts`:

```ts
export const eofFlush =
    <S, Cp>(toError: (state: S) => Cp) =>
    (state: S | null): readonly [List<Cp>, S | null] =>
        [state === null ? empty : [toError(state)], null]
```

Then:

```ts
// utf8
export const utf8EofToCodePointOp = eofFlush(utf8StateToError)
// utf16
const utf16EofToCodePointOp = eofFlush((state: number) => state | errorMask)
```

Two real consumers, one algorithm, and the flush contract ("leftover state
becomes exactly one error unit") is stated once next to the decoder that
drives it.

### Tasks

- [ ] Add `eofFlush` to `fjs/text/code_point/module.f.ts` beside `decoder`.
- [ ] Redefine both eof ops through it; keep JSDoc on the utf8 export.
- [ ] `npx tsc` clean; `fjs t` passes (utf8/utf16 proofs).

### Related

- `fjs/text/code_point/module.f.ts:33-41` — `decoder` (i168), the factory this
  completes.
- [word-classifier-dedup](../utf16/todo/word-classifier-dedup.md) — the
  companion fresh-dispatch extraction (utf8's half landed in PR #1258).
