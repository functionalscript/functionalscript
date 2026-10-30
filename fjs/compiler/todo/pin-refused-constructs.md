## Pin the constructs the compiler refuses

**Priority:** P3
**Status:** open

### Problem

A refusal is as much the language's contract as an accepted form, and the proofs
pin only some of them: the parser's `refused` tables and the grammar proof's
expectations pin many, and many constructs have no refusal proof at all.
[Refused constructs](../../../spec/todo/refused-constructs.md) is the register:
each refused construct and why it is refused. It does not record what the
compiler reports or whether a proof pins a row, since both change with the
compiler; a proof keeps them true, and this issue is the work of giving every
row one.

### Proposal

Pin a refusal where its failure is reported, with the message and position (or,
at the grammar, the token), and not only the fact that the module is an error:

- A construct the **grammar** has no rule for belongs in the parser's module
  refusal table (source, message, position), where `unexpected token` rows
  already live.
- A construct a **later step** refuses with a named message (`reserved word`,
  `const not found`, `prohibited property name`, …) belongs beside the proofs of
  that step.
- A **lexical** refusal belongs in the compiler tokenizer's proof.

Beside each pinned source, name the register row's ID (`op.in`), so the change
that admits the construct, which fails that proof, finds the row to delete.

Work the register in this order, since the earlier rows carry the more
committed claim:

1. Rows that are **design**: the specification states the refusal is
   permanent, so a proof costs nothing to keep true.
2. Rows that are **planned**. The proof also marks the place the admitting
   change will edit, and that change deletes the row.
3. Rows that are **open**, once the language designer has said whether each is
   permanent.

Pinning many rows at once is fine: they are one kind of change, a proof and no
behaviour, and a table of cases is one test.

### Tasks

- [ ] Find the proofs that already pin a row, upgrade those that assert only
      that the module is an error, and name the row's ID beside each.
- [ ] Pin the **design** rows that no proof pins.
- [ ] Pin the **planned** rows that no proof pins.
- [ ] Ask the language designer which **open** rows are permanent, and set
      their **Why**.
- [ ] Pin the **open** rows that no proof pins.
- [ ] Settle one possible gap: `0o7` is left out of the specification without
      a stated reason, while `0b` and `0x` are accepted. State the reason, or
      admit it, and then set its **Why**
      ([design principles §12](../../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)).

### Related

- [Refused constructs](../../../spec/todo/refused-constructs.md), the register.
- [The `in` record](../../../spec/todo/2346-in-operator.md), whose refusal
  proof, now of the computed key alone, is the model for the rest.
