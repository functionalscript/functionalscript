## `TupleTs`'s union distribution is unpinned

**Priority:** P3
**Status:** open

### Problem

The header on `_RestTuple` in [`../types.ts`](../types.ts) names three
mechanisms in `TupleTs` and the row that holds each:

> The rows that pin one mechanism each are `_VariadicPrefixRejectsMixedPrefix`
> (the guard), `_OptionalMember` (the fallback) and
> `_UnionKeepsBranchCorrelation` (the distribution).

Two of the three hold. The third does not. Each mechanism was removed on its
own and `tsc -p .` run over the whole repository:

| mutation | reports |
| --- | --- |
| `number extends M['length'] ? M : _SplitTs<T, M>` → `_SplitTs<T, M>` | `_VariadicPrefixRejectsMixedPrefix`, alone |
| `_SplitTs`'s outermost peel fallback → `readonly []` | `_OptionalMember`, alone |
| `TupleTs`'s `T extends Tuple` → `[T] extends [Tuple]` | **nothing, in any file** |

So the two named rows do exactly what the header credits them with, and the
distribution can be deleted with no observable effect anywhere. The same three
runs confirm the rest of that header: neither single mutation moves
`_RestTuple` or `_NonFixedLength`, which is what it says about those two.

**Which of two things this is, is the open question.** Either the outer
`T extends Tuple` is redundant — `MappedTs<T>` is a homomorphic mapped type
over a naked `T` and distributes on its own, and `_SplitTs`'s
`T extends readonly [...infer TI, infer TL]` is a distributive conditional
over a naked `T` as well, so the per-member behaviour may survive without
it — or it does something the pins do not reach, and that something is
unchecked. `_UnionKeepsBranchCorrelation` states a true fact either way:
`[number, boolean]` is rejected, with or without the line. It is not evidence
about the line.

This is not a regression. Those nine pins sat in `proof.f.mjs`'s `tupleTs`,
which was a body of nothing but typedefs, so none of them was resolved at all
and the question could not be asked
([`../../../AGENTS.md`](../../../AGENTS.md) §1.4). Moving them to module scope is
what made it askable, and the answer to two thirds of it is good.

It generalises past this file, which is the reason to write it down. A pin
that resolves and passes is one step, not two: **it also has to move when the
thing it names moves.** The whole-repository sweep answers the first and says
nothing about the second, and the header here is the only place in the tree
that claims the second outright.

### Proposal

Establish which case it is, then act on the answer.

If the line is redundant, delete it and correct the header: two mechanisms,
two rows, and a note that the union needs no distribution of its own because
the mapping and the peel both distribute. That is the better outcome — a
mechanism that does not exist needs no pin.

If it is load-bearing, find the shape that shows it. The pair `_BranchA` /
`_BranchB` does not, so a wider one is needed: the suspicion is a schema where
`MappedTs` cannot distribute for itself, which is what to look for rather than
a bigger tuple of the same kind. Write the row that fails when the line goes,
and only then say the header is true.

Either way the method is the one this file's pins were moved under: mutate the
mechanism, run `tsc`, and read which line reports. A row credited with a
mechanism no mutation moves is the same green leaf in a new place.

### Tasks

- [ ] Decide whether `T extends Tuple` in `TupleTs` has an observable effect,
      with a schema that shows it or an argument that none can.
- [ ] Delete the line and correct `_RestTuple`'s header, or add the row that
      fails without it.
- [ ] Re-run the three mutations above and record that each named mechanism
      now moves exactly one row.

### Related

- [`../types.ts`](../types.ts) — `TupleTs`, `_SplitTs`, and the nine pins under
  "`TupleTs`'s split, mechanism by mechanism".
- [`../../../AGENTS.md`](../../../AGENTS.md) §1.4 — why the pins were inert where
  they used to sit, and the falsify-once check a new one owes.
- [#1993](https://github.com/functionalscript/functionalscript/pull/1993) —
  where the pins moved and the measurement was taken.
