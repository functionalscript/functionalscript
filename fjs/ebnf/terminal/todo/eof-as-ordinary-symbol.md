## EOF as an ordinary input symbol

**Priority:** P3
**Status:** open

### Problem

[The contract](../../README.md#logical-eof-in-parser-input) has the backend
synthesize the one logical EOF after the physical input, and callers never
supply it. That works for an array, whose length says where the input ends. A
streaming parser ([43](../../todo/043-stateful-parser.md)) does not know where
the input ends until it is told, and the natural way to tell it is the last
symbol — so the synthesis has nothing to key on.

Synthesizing a symbol nobody sent also costs machinery in
[`../../ll1/module.f.mjs`](../../ll1/module.f.mjs), all of it in service of
giving that symbol a position it does not have:

- `symbolAt` answers `eofSymbol` for any `pos >= length` rather than reading
  the input, and `accepts` guards `pos <= length` so that nothing accepts a
  symbol past the consumed end.
- `leafAt` answers an empty node for the position past the last symbol,
  since there is no element to contribute.
- `physical` converts a cursor back before a position leaves the backend:
  consuming EOF is progress, so the cursor moves past the length, and both
  cursors report the length.
- A synthesized symbol has no caller metadata, and the engine may not invent
  any, so a mapping of `eof` receives an empty node and nothing to anchor a
  position on.

### Proposal

EOF is an ordinary symbol in an extended input range, supplied by the caller as
the last one. A parser does not treat it specially.

Every item above then deletes rather than moves. A real symbol advances the
cursor like any other, so `symbolAt` just reads the input, `physical` has
nothing to convert, `leafAt` has one case less, and EOF's metadata arrives
with the symbol.

A grammar that never mentions `eof` leaves it unconsumed. That is success, which
is what the synthesized symbol already amounts to today.

**The input symbol type widens, and it is a public one.** An input symbol is
a non-negative safe integer today — `symbolAt` asserts it — and `eofSymbol`
is `-1`, so the assertion moves the moment a caller must supply EOF. Every
signature carrying the input alphabet moves with it: `Parser`'s input, the
alphabets' `symbols` helpers, and [43](../../todo/043-stateful-parser.md)'s
fold.

**A consumed `eof` still contributes no AST leaf.** That is not the parser
treating the symbol specially — it is that there is nothing to put in a leaf.
Every other leaf stands for a source element; EOF stands for the absence of
one, and the caller supplies its metadata rather than an element it denotes.
The alternative was tried, on the classical backend, and is recorded below.

Only a rule that *names* `eof` reaches this at all. A repetition ends by
lookahead — `repeatFrom0(digit)` stops because the symbol at the cursor is
not a digit — so a number finishes without any terminal consuming EOF, and
nothing about EOF reaches its AST either way. The leaf question is confined to
grammars written like `[value, eof]`, which is how every whole-input grammar
in the tree ends.

`fjs/djs/parser` is the evidence that synthesis costs its callers rather than
saving them: `splitEof` in
[`../../../djs/parser/module.f.mjs`](../../../djs/parser/module.f.mjs)
strips the tokenizer's real `eof` token to avoid a second end marker and then
keeps that token's metadata in a side channel, because the synthesized symbol
has none to report a failure at end-of-input from. Both halves of that
workaround exist only because the backend invents the symbol.

**And EOF then carries metadata like any other symbol**, which is the point of
the change for [43](../../todo/043-stateful-parser.md): a mapping of `eof`
receives a real `Meta<I>` from the caller, so nothing has to invent one.

### Tasks

- [ ] Rewrite [the contract](../../README.md#logical-eof-in-parser-input) and
      `Parser`'s doc in `../../ll1/types.ts`. They stay true as written until
      the code changes, so they change *with* it, not before.
- [ ] Delete the extended-cursor handling in
      [`../../ll1/module.f.mjs`](../../ll1/module.f.mjs): `symbolAt`'s
      end case, `accepts`' guard, `leafAt`'s empty node, and `physical`.
- [ ] Update the callers to supply EOF. Under no-leaf every AST is unchanged,
      so no mapping moves — but every reader of a whole input does:
      `fjs/ebnf`'s own proofs; `fjs/media/json` and `fjs/media/datajs`; the
      `fjs/git` readers; `fjs/djs/tokenizer`, whose one-token grammar never
      names `eof` and whose loop ends at the length, so it supplies nothing
      and stops before the symbol; and `fjs/djs/parser`, which is the
      opposite problem and is described below.
- [ ] Delete `splitEof`'s reason for existing, and probably most of `splitEof`.
      With no synthesis there is no second marker to avoid: the tokenizer's
      `eof` token is the symbol the grammar's `eof` matches, its metadata
      rides along, and `eofMetadata` — threaded to `parseFromTokens`'
      `atEnd` branch — has nothing left to carry. `djsModule` requires `eof`,
      so this caller is not optional: leaving it stripped fails every valid
      module at its final terminal.
- [ ] Keep `splitEof`'s *validation* even where its stripping goes. It rejects a
      stream whose `eof` is not the single final token, and the grammar does
      not replace that check on its own: a `Parser` reports where a match
      ended, so `value, eof, eof` would succeed on the first marker with the
      second left unread unless the caller compares the end against the
      length. Either verify complete consumption there or keep an explicit
      exactly-one-final-EOF check; this is the documented public contract,
      not a tidy-up.
- [ ] Say what a caller's completeness check compares against (see the open
      question), since every whole-input reader has one.
- [ ] Prove a caller that omits EOF, and one that sends it early or twice —
      once the open question below says what those *should* do. The contract
      used to make all three unrepresentable; whether they are now failures or
      merely unconsumed input depends on that answer, so this proof cannot be
      written before it.

### Open question

**Must a grammar that parses a whole input name `eof`?** One unmade decision,
showing up in three places, which is why it is worth deciding once rather than
patching each.

The Proposal says a grammar that never mentions `eof` leaves it unconsumed and
that this is success. That is free for a parser backend and costs machinery
everywhere else:

- **The completeness check.** A reader asks whether the match's end is the
  input's length to mean "consumed everything". A grammar naming `eof` ends
  at the extended length; one that does not ends one short. No single
  comparison is right for both.
- **Malformed streams.** An omitted EOF parses identically for such a grammar,
  and an early one can be left unconsumed — so "a grammar rejects them" is
  not true, and a proof asserting it would fail.
- **The recognizer.** A `Fold<Symbol, State>` consumes every symbol, so folding
  a trailing EOF a grammar does not name drives an accepting state into the
  sink (see [recognizer-backend](../../todo/recognizer-backend.md)).

Requiring `eof` gives "consumed everything" one meaning, makes an omitted or
misplaced marker a real parse failure, and removes the recognizer's special
case. The cost is a genuine constraint on grammar authors and a rule that must
be stated, not discovered. The alternative is an exactly-one-final-EOF check at
the driver boundary, which every caller then owes.

Deciding this closes all three; leaving it open means each caller invents its
own answer, which is how `splitEof` came to exist.

### What a prototype found

Tried once on the classical `fjs/bnf` backends, before they were deleted,
and reverted. It settled the leaf question above; the rest does not bind the
implementation.

**The backend half is small and it works.** The end comparisons move by one,
`symbolAt` loses its conditional, and the extended cursor deletes. Both
classical backends typechecked clean, and the thousands of tests that did
not involve `eof` kept passing untouched.

**The cost is not there. It is the AST leaf**, which turns out to decide the
whole size of the change. Taking "a parser does not treat it specially" to mean
EOF contributes a leaf like any other symbol left 118 failures across the
djs modules and the backend proofs, and supplying EOF at `fjs/djs`'s entry
points made it worse, 118 → 227. That is the finding worth keeping: a
consumer that walks the AST meets an extra leaf as a node it has no case
for. Every AST consumer pays, and a mapped grammar pays at every mapping
whose rule ends in `eof`.

That is what decided the Proposal against it. A leaf is the uniform-looking
answer and costs every consumer a case; no leaf keeps every AST byte-identical
and confines the change to cursor arithmetic. The deciding argument was not the
cost, though: a leaf carries a source element and EOF has none, so
contributing nothing to the AST is the honest answer rather than a special
case retained for convenience.

### Related

- [43. Stateful parser](../../todo/043-stateful-parser.md) — where this came
  from, and the reason the synthesis model does not survive a streaming input.
- [`../../README.md`](../../README.md#logical-eof-in-parser-input) — the
  normative statement this replaces.
- [ebnf-range-set](./ebnf-range-set.md) — why EOF is not a set member, which
  is what lets a set terminal have one symbol leaf unconditionally.
