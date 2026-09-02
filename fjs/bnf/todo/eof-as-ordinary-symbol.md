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

**The input symbol type widens, and it is a public one.** `CodePoint` is
documented as `0x0000 to 0x10_FFFF`
([`../../text/utf16/types.ts`](../../text/utf16/types.ts)) and `eofSymbol` is
`-1`, so `Meta<M, CodePoint>` stops being true the moment a caller must supply
EOF. A BNF input symbol was already wider than a code point in practice —
`fjs/djs/parser` feeds token symbols through the same matcher — so this names
something that exists rather than adding a concept. Every signature carrying the
input alphabet moves with it: the matcher's input, terminal transformers, AST
leaf types, and [43](./043-stateful-parser.md)'s fold.

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

`fjs/djs/parser` is the evidence that synthesis costs its callers rather than
saving them: it strips the tokenizer's real `eof` to avoid a second end marker
and then keeps that token's metadata in a side channel, because the synthesized
symbol has none to report a failure at end-of-input from. Both halves of that
workaround exist only because the backend invents the symbol.

**And EOF now carries metadata like any other symbol**, which is the point of
the change for [43](./043-stateful-parser.md): a mapped `eof` terminal receives
a real `Meta<MI, Symbol>` from the caller, so nothing has to invent one.
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
- [ ] Update the callers to supply EOF. Under no-leaf every AST is unchanged,
      so no AST *walk* moves — but three callers do:
      - `fjs/bnf`'s own proofs, which append a symbol;
      - `fjs/djs/tokenizer`'s two entry points, which also compute EOF's
        metadata, the position just past the input;
      - `fjs/djs/parser`, which is the opposite problem and is described below.
- [ ] Delete `splitEof`'s reason for existing, and probably most of `splitEof`.
      [`../../djs/parser/module.f.mjs`](../../djs/parser/module.f.mjs) strips the
      tokenizer's final `eof` token before matching, because "a BNF parser
      backend synthesizes its own logical end-of-input, so passing the
      tokenizer's physical `eof` through as an ordinary symbol would create a
      second end marker", and stashes its metadata as `eofMetadata` because
      "dropping it outright would instead lose the source position that a failure
      *at* physical end has to be reported from". Both sentences describe this
      issue's problem, solved by hand in production code. With no synthesis there
      is no second marker to avoid: the tokenizer's `eof` token is the symbol the
      grammar's `eof` terminal matches, its metadata rides along, and
      `eofMetadata` — threaded to `parseFromTokens`' `atEnd` branch — has nothing
      left to carry. `djsModule` requires `eof`, so this caller is not optional:
      leaving it stripped fails every valid module at its final terminal.
- [ ] Keep `splitEof`'s *validation* even where its stripping goes. It rejects a
      stream whose `eof` is not the single final token, and the grammar does not
      replace that check: `descent` matches prefixes, and `parseFromTokens`
      destructures `{ ast, success, failure }` without `idx`, so `value, eof,
      eof` would succeed on the first marker and the second would go unread.
      Either verify complete consumption there or keep an explicit
      exactly-one-final-EOF check; this is the documented public contract, not a
      tidy-up.
- [ ] Say what a caller's completeness check compares against (see the open
      question), since the two entry points above each have one.
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

- **The completeness check.** `fjs/djs/tokenizer` asks `len !== cp.length` to
  mean "consumed everything". A grammar naming `eof` ends at the extended
  length; one that does not ends one short. No single comparison is right for
  both.
- **Malformed streams.** An omitted EOF parses identically for such a grammar,
  and an early one can be left unconsumed under prefix matching — so "a grammar
  rejects them" is not true, and a proof asserting it would fail.
- **The recognizer.** A `Fold<Symbol, State>` consumes every symbol, so folding
  a trailing EOF a grammar does not name drives an accepting state into the
  sink (see [recognizer-backend](./recognizer-backend.md)).

Requiring `eof` gives "consumed everything" one meaning, makes an omitted or
misplaced marker a real parse failure, and removes the recognizer's special
case. The cost is a genuine constraint on grammar authors and a rule that must
be stated, not discovered. The alternative is an exactly-one-final-EOF check at
the driver boundary, which every caller then owes.

Deciding this closes all three; leaving it open means each caller invents its
own answer, which is how `splitEof` came to exist.

### What a prototype found

Tried once and reverted. It settled the leaf question above; the rest does not
bind the implementation.

**The backend half is small and it works.** `pos <= cp.length` becomes
`pos < cp.length` and `pos > cp.length` becomes `pos >= cp.length`; `symbolAt`
loses its conditional; `physicalIdx` and the extended cursor delete. Both
backends and the matcher typecheck clean, and the 3,600-odd tests that do not
involve `eof` keep passing untouched.

**`leafAt` is the exception, and this prototype got it wrong** — it dropped the
conditional too, which is what a *leaf* answer wants and the Proposal rejects.
`leafAt` today is `pos < input.length ? [input[pos]] : []`, excluding EOF by
*position*, and once EOF is a real element that position test admits it. Under
no-leaf the condition does not go away, it changes shape: EOF is excluded by
*symbol*, so `leafAt` needs the `symbolOf` reader `symbolAt` already takes. Both
native terminal paths — [`../ll1/module.f.mjs`](../ll1/module.f.mjs) and
[`../descent/module.f.mjs`](../descent/module.f.mjs), each
`mrSuccess(tag, leafAt(cp, pos), pos + 1)` — go straight through it, so getting
this wrong is exactly the unchanged-AST guarantee failing.

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
