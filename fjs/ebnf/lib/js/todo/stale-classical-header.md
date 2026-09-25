## Module header describes the deleted classical grammar

**Priority:** P4
**Status:** open

### Problem

The module JSDoc of [`../module.f.mjs`](../module.f.mjs) compares this grammar
with "the classical grammar in `fjs/fsc/tokenizer`, which the backtracking
backend read", in the present tense — "the classical grammar swallows it and
splits it back out below the grammar" — and `operators`' JSDoc lists "the
operators the classical grammar names". That grammar and the backtracking
backend were deleted with `fjs/bnf`, and `fjs/fsc/tokenizer` now holds no
grammar at all: it demotes keywords over the stream of
[`fjs/js/tokenizer`](../../../../js/tokenizer/module.f.mjs), which reads this
grammar. A reader following the header looks for a grammar that is not there.

The comparison itself is worth keeping: it is the record of what the port
changed, and [`fjs/fsc/README.md`](../../../../fsc/README.md#both-grammars-are-ll1)
("Both grammars are LL(1)") already states it in the past tense.

### Tasks

- [ ] Rewrite the module header and `operators`' JSDoc in the past tense,
      pointing at `fjs/fsc/README.md`'s record instead of at
      `fjs/fsc/tokenizer`.
- [ ] `tsc`, `fjs test`.

### Related

- [`fjs/fsc/README.md`](../../../../fsc/README.md#both-grammars-are-ll1) — the
  record of the port.
- [`fjs/js/tokenizer`](../../../../js/tokenizer/module.f.mjs) — the reader of
  this grammar today.
