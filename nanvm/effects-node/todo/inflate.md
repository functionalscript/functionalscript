## Implement `inflate` natively, with no dependency

**Priority:** P2
**Status:** wip

### Problem

`inflate` of [`fjs/effects/node/types.ts`](../../../fjs/effects/node/types.ts)
is the one effect of the Node set the native runner still answers with
`notImplemented`. The FJS git modules (`fjs/git/loose`, `object`, `packidx`)
read objects through it, so the self-hosted CLI
([console-program](../../lib/todo/console-program.md)) cannot read a repository
without it. It is the last unchecked effect of the
[operations list](../../../todo/nanvm-effects-node-operations.md) apart from
`test`, which [stays unimplemented](./test-effect.md).

### Contract

The Node runner (`inflate` in
[`fjs/effects/node/module.mjs`](../../../fjs/effects/node/module.mjs)) is the
reference:

- the input is one zlib stream (RFC 1950) holding DEFLATE data (RFC 1951);
- the answer is the bytes it holds, at most 128 KiB, the bound of `readFile`;
  a stream that inflates to more is **refused**, never cut short;
- bytes after the end of the stream are refused with `ERR_TRAILING_BYTES` and
  `inflateTrailingMessage`;
- a `Vec` that is not whole bytes never reaches the host.

### Proposal

A decoder in `nanvm-effects-node`, **with no new dependency**: the crate depends
on `nanvm-lib` alone, and inflate is small enough to own. The bound is checked
as the output grows, so a hostile stream costs the cap and not what it would
expand to. Every malformed stream is an error — a bad header, checksum, block
type, code length, distance beyond the output, or a truncated stream — and none
panics. Stored, fixed-Huffman and dynamic-Huffman blocks are all decoded.

Tests: the fixtures of the existing parity corpus compare the two hosts through
`nanvm/harness/fixtures/parity.mjs`; the decoder adds unit tests for each block
type, the bound, trailing bytes, and each malformed case.

### Alternative: an inflater in FunctionalScript

The type's own doc says the effect stands in "until a FunctionalScript inflater
exists". Business logic belongs in FJS, and an FJS inflater compiled to Rust
would serve every host and retire the effect. That is a larger task, gated on
the compiler covering the loops and bit operations it needs, so it is not a
reason to leave the native runner without `inflate` meanwhile. Revisit it when
the compiler covers them.

### Tasks

- [ ] The decoder, its bound and its errors, with unit tests.
- [ ] Wire `inflate` into the runner; the trailing-bytes refusal as the Node
      runner words it.
- [ ] A parity case against the Node runner.
- [ ] Check the box in the operations list; delete this file.
