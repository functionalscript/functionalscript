## error-tag-layout-constants. Name the partial-state/error-tag bit layout once

**Priority:** P4
**Status:** open

### Problem

`codePointToUtf8`'s error branch (`fjs/text/utf8/module.f.mjs:130-151`) and
`utf8StateToError` (`:173-198`) are exact inverses that both hardcode the
same un-named partial-state flag offsets:

- `0b1000_0000_0000_0000` at `:131` and `:191`
- `0b0000_0100_0000_0000` at `:138` and `:183`
- `0b0000_0010_0000_0000` at `:144` and `:185`
- `0b0000_0000_1000_0000` at `:150`

The "partial UTF-8 state ↔ error-tagged code point" bit layout is documented
only as a table in `fjs/text/README.md` (the "utf8 error" sections), so the
contract lives in three places (two code, one doc) that must agree, with
nothing tying them together.

### Proposal

Define named constants (or a small encode/decode pair) for the layout flags
once — e.g. next to `errorMask` in `fjs/text/code_point/module.f.mjs`, or at
the top of `fjs/text/utf8/module.f.mjs` if the layout is considered
utf8-private — and use them in both functions. Names should follow the
README's terminology so the doc table and the constants are trivially
cross-checkable.

**Caution:** this borders the open `666-utf16-encode-errormask` contract
work and any change must be proven byte-identical against
`fjs/text/utf8/proof.f.mjs` before landing. It is a naming/single-source
cleanup, not a behavior change — if the layout itself is revisited by the
utf16 work, land that first and fold this in.

### Tasks

- [ ] Name the flag constants once; rewrite `codePointToUtf8`'s error branch
      and `utf8StateToError` in terms of them.
- [ ] Cross-link the constants and the README table.
- [ ] `tsc`, `fjs t`; proofs must pass unchanged.

### Related

- `fjs/text/README.md` — the layout's specification tables.
- `fjs/text/todo/666-utf16-encode-errormask.md` — adjacent errorMask
  contract work; coordinate ordering.
