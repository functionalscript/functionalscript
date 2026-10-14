## Pin the constructs the compiler refuses

**Priority:** P3
**Status:** open

### Problem

A refusal is as much the language's contract as an accepted form, and the proofs
pin only some of them: the parser's `refused` tables and the grammar proof's
expectations pin many, and many constructs have no refusal proof at all.
[Refused constructs](../../../spec/todo/refused-constructs.md) is the register:
each refused construct, why it is refused, what the compiler reports, and
whether a proof pins it. This issue is the work of closing its **Pin** column.

### Proposal

Pin a refusal where its failure is reported, with the message and position (or,
at the grammar, the token), so a row is **exact** and not **loose**:

- A construct the **grammar** has no rule for belongs in the parser's module
  refusal table (source, message, position), where `unexpected token` rows
  already live.
- A construct a **later step** refuses with a named message (`reserved word`,
  `const not found`, `prohibited property name`, …) belongs beside the proofs of
  that step.
- A **lexical** refusal belongs in the compiler tokenizer's proof.

Work the register in this order, since the earlier rows carry the more
committed claim:

1. Rows that are **design** and **none**: the specification states the refusal
   is permanent, so a proof costs nothing to keep true.
2. Rows that are **planned** and **none**. The proof also marks the place the
   admitting change will edit, and that change deletes the row.
3. Rows that are **open** and **none**, once the language designer has said
   whether each is permanent.
4. Rows that are **loose**: upgrade them to **exact**.

A pull request sets the **Pin** of the rows it pins, as the register says.
Pinning many rows at once is fine: they are one kind of change, a proof and no
behaviour, and a table of cases is one test.

### Tasks

- [ ] Confirm each **none** in the register by searching the proofs for a
      refusal that pins it, and set the ones that are found.
- [ ] Pin the **design** rows that are **none**.
- [ ] Pin the **planned** rows that are **none**.
- [ ] Ask the language designer which **open** rows are permanent, and set
      their **Why**.
- [ ] Pin the **open** rows that are **none**.
- [ ] Upgrade the **loose** rows to **exact**.
- [ ] Settle the one possible gap the survey turned up: `0o7` is refused by
      design for numbers while `0b` and `0x` are accepted. State the reason
      in the specification if there is one
      ([design principles §12](../../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)).

### Related

- [Refused constructs](../../../spec/todo/refused-constructs.md), the register.
- [The `in` decision](../../../spec/todo/2346-in-operator.md), whose refusal
  proof is the model for the rest.
