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

**A consumed `eof` still contributes no AST leaf.** That is not the parser
treating the symbol specially — it is that there is nothing to put in a leaf.
Every other leaf stands for a source character; EOF stands for the absence of
one, and the caller supplies its metadata rather than a character it denotes.
The alternative was tried and is recorded below.

Only a rule that *names* `eof` reaches this at all. A repetition ends by
lookahead — `digits = repeat(digit)` stops because the symbol at the cursor is
not a digit — so a number finishes without any terminal consuming EOF, and
nothing about EOF reaches its AST either way. The leaf question is confined to
grammars written like `document = [value, eof]`.

**And EOF now carries metadata like any other symbol**, which is the point of
the change for [43](./043-stateful-parser.md): a mapped `eof` terminal receives
a real `Meta<MI, CodePoint>` from the caller, so nothing has to invent one.
That also retires [207 §2](./207-bnf-semantic-actions.md)'s `[EOF, identity]`
row — one of the three places the metadata identity was being spent, and the
one that was only pretending to have no metadata. The empty `Sequence` and the
zero-round `Repeat` genuinely have no children; EOF never did.

The leaf decision and the metadata are independent, being the two halves of one
pair: `astTerminal` returns `[{ tag, sequence }, metadata]`, and only `sequence`
is at stake.

### Tasks

- [ ] Rewrite [the contract](../README.md#logical-eof-in-parser-input) and
      `Cursor`'s docstring. They stay true as written until the code changes, so
      they change *with* it, not before.
- [ ] Delete `physicalIdx` and the extended-position handling in
      [`../matcher/`](../matcher/module.f.mjs), `../ll1/` and `../descent/`,
      including both `private.ts` frame types.
- [ ] Update the callers to append EOF. Under no-leaf every AST is unchanged,
      so this is `fjs/bnf`'s own proofs and the two `fjs/djs/tokenizer` entry
      points, which also compute EOF's metadata — the position just past the
      input. `fjs/djs`'s AST walks are untouched.
- [ ] Say what a caller's completeness check compares against (see the open
      question), since the two entry points above each have one.
- [ ] Prove a caller that omits EOF, and one that sends it early or twice. The
      contract used to make all three unrepresentable; now they are ordinary
      input a grammar rejects, and that should be pinned rather than assumed.

### Open question

**What does a caller's completeness check compare against?** `fjs/djs/tokenizer`
asks `len !== cp.length` to mean "the match consumed everything". With EOF
appended the answer depends on the grammar, and the Proposal above makes both
readings legal: a grammar naming `eof` consumes it and ends at the extended
length, while one that does not leaves EOF unconsumed — which the Proposal calls
success, one short of the extended length. So there is no single comparison that
is right for every caller.

Either the check is stated per grammar, or grammars parsing a whole input are
required to name `eof` so that "consumed everything" has one meaning. The second
is tempting and is a real constraint on grammar authors, so it should be decided
rather than absorbed into whichever comparison the first caller happens to need.

### What a prototype found

Tried once and reverted. It settled the leaf question above; the rest does not
bind the implementation.

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

That is what decided the Proposal against it. A leaf is the uniform-looking
answer and costs a rework of DJS's walk; no leaf keeps every AST
byte-identical and confines the change to cursor arithmetic. The deciding
argument was not the cost, though: a leaf carries a source element and EOF has
none, so contributing nothing to the AST is the honest answer rather than a
special case retained for convenience.

### Related

- [43. Stateful parser](./043-stateful-parser.md) — where this came from, and
  the reason the synthesis model does not survive a streaming input.
- [207 §2](./207-bnf-semantic-actions.md) — "at EOF, no leaf exists", which the
  open question above revisits.
- [`../README.md`](../README.md#logical-eof-in-parser-input) — the normative
  statement this replaces.
