## The LL(1) tree carries no metadata

**Priority:** P3
**Status:** open

### Problem

`parser` takes a list of symbols and builds `Ast<R>`, whose leaves are the
symbols. Nothing pairs a symbol with where it came from, so a consumer that
wants a position in an error message — a line and column, a byte offset, a
token's span — has nowhere to read it from once the tree is built; the only
position the backend reports is the index a match stopped or failed at.

The classical backend threaded a metadata monoid through every value, and
[ebnf-migration](../../../todo/ebnf-migration.md) names "metadata per the
moved issues" as part of the `ll1/` rewrite. The rewrite shipped without it:
`Ast<R>` carries none, `../map`'s README says a metadata channel is a backend
concern until a consumer asks for one, and no consumer has yet. The first is
the djs port, whose tokenizer reports positions today.

### Proposal

Decide when that consumer arrives, not before. Two shapes fit the layers as
they are:

- **Metadata beside the tree.** The parser returns, with each leaf's index in
  the input, enough for a consumer to recover a position from the input it
  already holds. The tree stays `Ast<R>`, and `rewrite` stays as it is.
- **A leaf type parameter.** `Ast<R, L>` with the leaf `L` in place of
  `number`, so the input is a `readonly L[]` and a symbol is read out of a
  leaf; `rewrite`'s children rows change with it, which is the one more
  child position its README says a metadata channel would be.

### Tasks

- [ ] Choose, when the djs port needs positions.
- [ ] Amend `../README.md` and `../../map/README.md` with the choice.

### Related

- [`../README.md`](../README.md) — "Left for later".
- [`../../map/README.md`](../../map/README.md) — "No metadata channel".
- [ebnf-migration](../../../todo/ebnf-migration.md) — the consumer port.
