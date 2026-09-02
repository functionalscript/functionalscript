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

- [ ] Settle whether EOF contributes an AST leaf — the prototype below shows
      this decides the size of everything after it, so settle it first.
- [ ] Rewrite [the contract](../README.md#logical-eof-in-parser-input) and
      `Cursor`'s docstring. They stay true as written until the code changes, so
      they change *with* it, not before.
- [ ] Delete `physicalIdx` and the extended-position handling in
      [`../matcher/`](../matcher/module.f.mjs), `../ll1/` and `../descent/`,
      including both `private.ts` frame types.
- [ ] Update the callers: ~34 sites construct parser input across `fjs/bnf`'s
      proofs and `fjs/djs`'s parser and tokenizer, and each now appends EOF.
      `fjs/djs/tokenizer`'s two entry points also compute EOF's metadata — the
      position just past the input — and its `len !== cp.length` checks compare
      against the extended length.
- [ ] Prove a caller that omits EOF, and one that sends it early or twice. The
      contract used to make all three unrepresentable; now they are ordinary
      input a grammar rejects, and that should be pinned rather than assumed.

### What a prototype found

Tried once and reverted; this does not bind the implementation.

**The backend half is small and it works.** `pos <= cp.length` becomes
`pos < cp.length` and `pos > cp.length` becomes `pos >= cp.length`; `symbolAt`
and `leafAt` lose their conditionals; `physicalIdx` and the extended cursor
delete. Both backends and the matcher typecheck clean, and the 3,600-odd tests
that do not involve `eof` keep passing untouched.

**The cost is not there. It is the AST leaf**, which turns out to decide the
whole size of the change. Taking "a parser does not treat it specially" to mean
EOF contributes a leaf like any other symbol left 118 failures — 62 in
`fjs/djs/parser`, 27 in `fjs/djs`, 12 in `fjs/bnf/ll1`, 10 in
`fjs/djs/transpiler`, 6 in `fjs/bnf/descent`, 1 in `fjs/bnf/matcher`.

**Supplying EOF at `fjs/djs`'s entry points made it worse, 118 → 227.** That is
the finding worth keeping. `fjs/djs/tokenizer` walks the AST to recover tokens,
so an extra leaf is not a new value at the end of a list — it is a node its
walk meets and has no case for. Every AST consumer pays, and `fjs/djs` is the
one with the most walking.

So the leaf question is not a detail to settle while implementing; it is what
the issue is about:

- **A leaf** is the uniform answer, and it changes the AST of every grammar
  matching `eof`. `descentEquivalence`, `fjs/bnf`'s AST expectations, and
  `fjs/djs`'s token extraction all move. Doing it means reworking DJS's walk,
  not just its call sites.
- **No leaf** keeps every AST byte-identical and confines the change to cursor
  arithmetic — the four deletions above, and callers appending a symbol whose
  only visible effect is that `eof` now matches it. One special case survives in
  the design that removes the rest, and it is the cheap one: `leafAt` returning
  `[]` for the last symbol is a line, while the extended cursor was a concept.

Worth noting the second is not merely cheaper. A leaf carries a *source
element*, and EOF still has none: the caller supplies its metadata, not a
character it stands for. Contributing nothing to the AST may be the honest
answer rather than the special case.

### Related

- [43. Stateful parser](./043-stateful-parser.md) — where this came from, and
  the reason the synthesis model does not survive a streaming input.
- [207 §2](./207-bnf-semantic-actions.md) — "at EOF, no leaf exists", which the
  open question above revisits.
- [`../README.md`](../README.md#logical-eof-in-parser-input) — the normative
  statement this replaces.
