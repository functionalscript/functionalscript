## error-tag-layout-constants. Name the partial-state/error-tag bit layout once

**Priority:** P4
**Status:** open

### Problem

`codePointToUtf8`'s error branch (`fs/text/utf8/module.f.ts:107-128`) and
`utf8StateToError` (`:148-173`) are exact inverses that both hardcode the
same un-named partial-state flag offsets:

- `0b1000_0000_0000_0000` at `:108` and `:166`
- `0b0000_0100_0000_0000` at `:115` and `:158`
- `0b0000_0010_0000_0000` at `:121` and `:159`
- `0b0000_0000_1000_0000` at `:127`

The "partial UTF-8 state ↔ error-tagged code point" bit layout is documented
only as a table in `fs/text/README.md` (the "utf8 error" sections), so the
contract lives in three places (two code, one doc) that must agree, with
nothing tying them together.

### Proposal

Define named constants (or a small encode/decode pair) for the layout flags
once — e.g. next to `errorMask` in `fs/text/code_point/module.f.ts`, or at
the top of `fs/text/utf8/module.f.ts` if the layout is considered
utf8-private — and use them in both functions. Names should follow the
README's terminology so the doc table and the constants are trivially
cross-checkable.

**Caution:** this borders the open `666-utf16-encode-errormask` contract
work and any change must be proven byte-identical against
`fs/text/utf8/proof.f.ts` before landing. It is a naming/single-source
cleanup, not a behavior change — if the layout itself is revisited by the
utf16 work, land that first and fold this in.

### Tasks

- [ ] Name the flag constants once; rewrite `codePointToUtf8`'s error branch
      and `utf8StateToError` in terms of them.
- [ ] Cross-link the constants and the README table.
- [ ] `npx tsc`, `fjs t`; proofs must pass unchanged.

### Related

- `fs/text/README.md` — the layout's specification tables.
- `fs/text/todo/666-utf16-encode-errormask.md` — adjacent errorMask
  contract work; coordinate ordering.
