## fjs/edag/README.md calls producers and executors staged work

**Priority:** P4
**Status:** open

### Problem

[`../README.md`](../README.md) says the module "owns the data model only" and
that "Producers and executors are staged work that will consume it — the
FunctionalScript compiler lowering parsed modules to EDAG …, the interpreter
and Rust code generation executing it". All three have landed:

- [`fjs/fsc/edag`](../../fsc/edag/module.f.mjs) lowers parsed modules to the
  EDAG and links them (`unresolved`, `resolve`);
- [`../amnesia`](../amnesia/module.f.mjs) and [`../memo`](../memo/module.f.mjs)
  execute it, over the shared [`../operations`](../operations/module.f.mjs)
  and [`../analysis`](../analysis/module.f.mjs) table;
- [`../rust`](../rust/module.f.mjs) prints it as Rust over `nanvm-lib`.

A reader of the README is told the graph has no consumer yet.

### Tasks

- [ ] Rewrite the sentence to name the current producer and consumers, keeping
      the one-way dependency statement.

### Related

- [`analysis.md`](./analysis.md) — the table both executors and the writer
  read.
