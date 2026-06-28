## Detector classifies control-byte blobs as text; add `isTextCodePoint`

**Priority:** P3
**Status:** open

### Problem

The `fs/mime` detector equates *valid UTF-8* with *text*, but they are not the
same. Every C0 control byte (`0x00`–`0x1F`) is a valid single-byte UTF-8 code
point, so a binary blob made of control bytes passes validation and is
classified `text/plain`. The sharpest case is **NUL**: a blob of `00 00 00…`
decodes to a run of U+0000, is "valid UTF-8," and `cas_get` reports
`type: 'text'`, `mime_type: 'text/plain'` — even though a NUL byte is the single
most reliable binary marker (`git`, `file(1)`, `grep -I` all treat it as binary).

The `text` decision today is just "valid UTF-8 + byte-aligned" — `utf8Step`
checks only `isValidCodePoint` (well-formedness) and `finish` reads `utf8Valid`.
There is no check that the decoded code points are *text-appropriate*:

```ts
// fs/mime/module.f.ts
const utf8Step = (u, byte) => {
    ...
    if (!isValidCodePoint(cp)) { return { st, valid: false } }   // validity only
    ...
}
// finish: utf8Valid(s.utf8) && byte-aligned  ->  text/plain
```

So metadata-only `cas_get` mislabels control-bearing binary as text.

### Proposal

Separate *well-formedness* from *text-ness* with a new predicate, leaving
`isValidCodePoint` untouched (it gates decoding — `fromVec`, the utf8 validity
factor — and control chars are legitimately decodable):

1. **Add `isTextCodePoint` to `fs/text/code_point/module.f.ts`** — the shared
   home for the cross-codec Unicode contract (`errorMask`, `decoder`, and, per
   [share-code-point-predicates](../../text/code_point/todo/share-code-point-predicates.md),
   the code-point classification predicates). A **code-point** predicate (not a
   raw-byte check) so it composes with the decoder and can see C1 controls, which
   arrive as 2-byte UTF-8 (`C2 80`…`C2 9F`) and are invisible at the byte level:

   > A code point is a *text* code point unless it is a control character. The
   > controls are `U+0000`–`U+001F`, `U+007F` (DEL), and `U+0080`–`U+009F` (C1),
   > **minus** the whitespace block `U+0009`–`U+000D` (TAB, LF, VT, FF, CR), which
   > is legitimate in text.

   That is: allow the `0x09`–`0x0D` whitespace controls; reject every other C0
   control, DEL, and the C1 controls; everything `≥ 0x20` that is not DEL/C1 is
   text.

2. **Use it in the `fs/mime` detector.** Apply `isTextCodePoint` to the decoded
   code points in the utf8/text factor (alongside, but distinct from, the
   `isValidCodePoint` well-formedness check) and have `finish` classify `text`
   only when the blob is valid UTF-8 **and** every code point is a text code
   point. A valid-but-non-text blob (NUL, other controls) falls through to the
   `base64` / `application/octet-stream` branch.

`detectStream` and `detectVec` stay consistent (same machine). `fromVec` is
unchanged — it is the decoder used *after* classification, and since a
control-bearing blob now classifies as `base64`, `fromVec` is never reached for
it.

### Scope: text-or-binary only (for now)

This keeps `cas_get` a two-way `text` / `base64` split. Control characters that
have legacy "text-ish" uses — `ESC` (`0x1B`, ANSI color sequences), `BEL`, `BS`,
the `FS`/`GS`/`RS`/`US` separators — are deliberately treated as **binary** here;
`text/plain` should not imply terminal escapes or overstrike. In the future we
may recognize richer subtypes (colored ANSI text, and other file kinds) as their
own MIME types rather than folding them into `text/plain`; that is a separate,
larger classification effort and out of scope for this issue.

### Tasks

- [ ] Add `isTextCodePoint` to `fs/text/code_point/module.f.ts` (controls
      `U+0000`–`U+001F`, `U+007F`, `U+0080`–`U+009F` minus `U+0009`–`U+000D`),
      with proof coverage; note this consumer in
      [share-code-point-predicates](../../text/code_point/todo/share-code-point-predicates.md)
- [ ] Track a text verdict in the `fs/mime` utf8/text factor via
      `isTextCodePoint`, kept distinct from the `isValidCodePoint` validity check
- [ ] `finish` returns `text` only when valid UTF-8 **and** all code points are
      text code points; otherwise `base64` / `application/octet-stream`
- [ ] Proofs: NUL blob and other-control blobs → `base64`; text with TAB/LF/CR
      (and FF/VT) stays `text`; `cas_get` round-trip for a NUL-bearing blob
- [ ] Leave `isValidCodePoint` and `fromVec` unchanged; confirm `fjs t` and
      `npx tsc` clean

### Related

- [utf8-decoder-accepts-overlong](../../text/utf8/todo/utf8-decoder-accepts-overlong.md)
  — the sibling UTF-8 validity gap; this issue is the orthogonal text-vs-binary
  classification gap (valid UTF-8 that is not text)
- [share-code-point-predicates](../../text/code_point/todo/share-code-point-predicates.md)
  — `isTextCodePoint` is exactly the kind of shared code-point predicate that todo
  proposes consolidating in `code_point`
- `fs/mime` `detectStream` / `detectVec`; PR
  [#1181](https://github.com/functionalscript/functionalscript/pull/1181) — the
  streaming detector this refines
