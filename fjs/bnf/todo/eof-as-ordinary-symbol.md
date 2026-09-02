## EOF as an ordinary input symbol

**Priority:** P3
**Status:** open

### Problem

[The contract](../README.md#logical-eof-in-parser-input) has each backend
synthesize the one logical EOF after the physical input, and callers never
supply it. That works for an array, whose length says where the input ends. A
streaming parser ([43](./043-stateful-parser.md)) does not know where the input
ends until it is told, and the natural way to tell it is the last symbol — so
the synthesis has nothing to key on.

Synthesizing a symbol nobody sent also costs machinery, all of it in service of
giving that symbol a position it does not have:

- `Cursor` is an *extended* position: `0 .. length` are physical and
  `length + 1` is "EOF consumed", the `(idx, eofConsumed)` pair written as one
  number ([`../matcher/types.ts`](../matcher/types.ts)).
- `physicalIdx` converts it back before a position leaves a backend.
- `symbolAt` returns `eofSymbol` for any `pos >= input.length` rather than
  reading the input ([`../matcher/module.f.mjs`](../matcher/module.f.mjs)).
- And `Cursor`'s own docstring records the trap: consuming EOF is progress even
  though `idx` does not move, and "a backend that treated it as no progress
  would loop forever on a repetition over a rule that can match EOF".
- For [43](./043-stateful-parser.md) it costs one more thing: a synthesized
  symbol has no caller metadata, and the engine may not invent any, so the
  parser would need an `eof: MI` constant purely to fill that hole.

### Proposal

EOF is an ordinary symbol in an extended input range, supplied by the caller as
the last one. A parser does not treat it specially.

Every item above then deletes rather than moves. A real symbol advances `idx`
like any other, so `Cursor` is a plain index, `physicalIdx` has nothing to
convert, `symbolAt` just reads the input, the progress trap cannot be fallen
into, and EOF's metadata arrives with the symbol.

A grammar that never mentions `eof` leaves it unconsumed. That is success, which
is what the synthesized symbol already amounts to today.

### Tasks

- [ ] Settle whether EOF contributes an AST leaf (see the open question) — the
      answer decides how much of the proof tree moves, so settle it first.
- [ ] Rewrite [the contract](../README.md#logical-eof-in-parser-input) and
      `Cursor`'s docstring. They stay true as written until the code changes, so
      they change *with* it, not before.
- [ ] Delete `physicalIdx` and the extended-position handling in
      [`../matcher/`](../matcher/module.f.mjs), `../ll1/` and `../descent/`,
      including both `private.ts` frame types.
- [ ] Update the callers: ~34 sites construct parser input across `fjs/bnf`'s
      proofs and `fjs/djs`'s parser and tokenizer, and each now appends EOF.
- [ ] Prove a caller that omits EOF, and one that sends it early or twice. The
      contract used to make all three unrepresentable; now they are ordinary
      input a grammar rejects, and that should be pinned rather than assumed.

### Open questions

- **Does EOF contribute an AST leaf?** Today it cannot — `leafAt` in
  [`../matcher/module.f.mjs`](../matcher/module.f.mjs) is
  `value === eofSymbol ? [] : [[value, metadata]]` — because a synthesized
  symbol has no source element and no metadata to put in a leaf. A
  caller-supplied EOF has both, and "a parser does not treat it specially" reads
  as *yes, a leaf*. But that changes the AST of every grammar matching `eof`,
  so `descentEquivalence` and the AST expectations in
  [`../ll1/proof.f.mjs`](../ll1/proof.f.mjs) move with it. Answering "no leaf"
  keeps the AST fixed at the cost of one special case surviving in the design
  that removes the rest.

### Related

- [43. Stateful parser](./043-stateful-parser.md) — where this came from, and
  the reason the synthesis model does not survive a streaming input.
- [207 §2](./207-bnf-semantic-actions.md) — "at EOF, no leaf exists", which the
  open question above revisits.
- [`../README.md`](../README.md#logical-eof-in-parser-input) — the normative
  statement this replaces.
