# 666-utf8-continuation-helpers. Name the repeated UTF-8 continuation-byte bit patterns

**Priority:** P5
**Status:** open

## Problem

The two core bit operations of UTF-8 are written out by hand at nearly every call
site inside `fs/text/utf8/module.f.ts`:

- **"emit a continuation byte"** — `x & 0b0011_1111 | 0b1000_0000`
- **"read a continuation byte's 6 payload bits"** — `byte & 0b0011_1111`

The continuation-byte *encode* expression appears ~7 times in `codePointToUtf8`
(`:56`, `:61`, `:62`, `:68`, `:69`, `:70`, `:77`, `:78`, `:84`, `:85`, `:90`, `:91`):

```ts
// fs/text/utf8/module.f.ts:61-62
input >> 6 & 0b0011_1111 | 0b1000_0000,
input & 0b0011_1111 | 0b1000_0000,
```

and the continuation-byte *decode* mask (`& 0b0011_1111`) recurs across
`utf8StateToError` (`:124`, `:125`, `:131`, `:132`) and `utf8ByteToCodePointOp`
(`:164`, `:173`, `:174`, `:183`, `:184`):

```ts
// fs/text/utf8/module.f.ts:183-184
((s0 & 0b0000_0111) << 18) + ((s1 & 0b0011_1111) << 6) +
((s2 & 0b0011_1111) << 6) + (byte & 0b0011_1111),
```

The 6-bit payload mask `0b0011_1111` and the continuation tag `0b1000_0000` are
each repeated roughly a dozen times, and the lead-byte tag/mask pairs
(`0b1100_0000`/`0b0001_1111`, `0b1110_0000`/`0b0000_1111`, `0b1111_0000`/`0b0000_0111`)
are repeated between encoder and decoder — which are exact inverses of one another.
A single wrong mask silently corrupts encoding or decoding with no type-level signal.

## Proposal

This is an **intra-module** clarity/DRY improvement — no new shared module. Add a
couple of module-scope helpers and named constants in `utf8/module.f.ts`:

```ts
const contByte = (x: number): number => (x & 0b0011_1111) | 0b1000_0000  // encode
const contPayload = (b: number): number => b & 0b0011_1111               // decode
```

and name the lead-byte tag/mask pairs once. Rewrite the four functions
(`codePointToUtf8`, `utf8StateToError`, `utf8ByteToCodePointOp`, and the error-
reconstruction branch) in terms of them.

Note: this stays within the project's "hand-tuned bit code is acceptable" stance —
the goal is to give the *repeated* spec constant exactly one definition, not to add
abstraction layers. UTF-16's `codePointToUtf16` (`fs/text/utf16/module.f.ts:109`)
uses the same surrogate-bit arithmetic and could share none-to-some of these if it
proves natural, but keep the change scoped to utf8 first.

## Tasks

- [ ] add `contByte` / `contPayload` helpers and named lead-byte constants at module scope
- [ ] rewrite `codePointToUtf8`, `utf8StateToError`, `utf8ByteToCodePointOp` through them
- [ ] confirm `utf8/proof.f.ts` still passes unchanged (pure refactor)

## Related

- `fs/text/utf8/module.f.ts` — `codePointToUtf8` (:51), `utf8StateToError` (:114),
  `utf8ByteToCodePointOp` (:150)
- [i666-utf16-encode-errormask](./666-utf16-encode-errormask.md) — sibling encoder consistency
