## repeat-fold-mapping. Map a repetition as a fold over its rounds

**Priority:** P4
**Status:** open

### Problem

A repetition's mapping receives all of its rounds at once — the flat array
`Ast` gives the form — so a top-level `repeat(statement)` holds one mapped
value per statement until the last round closes, and only then folds them.
For a layer whose entry is such a repetition, that is the whole output held
at once where the layer above could have consumed it one item at a time.
The machine already accumulates the rounds as a list, one per round
(`_RepeatFrame.rounds`), so the cost is the list, not a copy.

### Proposal

A second form of mapping for a repetition — `init`, `update` over each round
as it arrives, `end` when the repetition closes — so the frame holds the
fold's state rather than the rounds. The five emit sites stay; `round`
applies `update` where the frame carries a fold and `end` where it would
have applied the mapping. Whether the result is still one `Meta<O>`, or the
fold's state is handed to the layer above as a stream, is the question
[043-stateful-parser](../../../bnf/todo/043-stateful-parser.md) holds for
the input side and is not decided here.

### Tasks

- [ ] The fold form of a mapping, beside the whole-node form, with its type
      in [`../types.ts`](../types.ts).
- [ ] `round` applying it; a proof that the rounds are never held.
- [ ] `tsc`, `fjs test`, 100% coverage.

### Related

- [`../README.md`](../README.md) — "The rewrite set, and how it is folded",
  and the frame that holds the rounds.
- [043-stateful-parser](../../../bnf/todo/043-stateful-parser.md) — the
  streaming input this would pair with.
