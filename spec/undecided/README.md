# Undecided Constructs

**Status:** open, a decision owed for each row

**These constructs are not decided yet.** Each is valid JavaScript that
`fjs compile` refuses today, and no record says whether it stays out of
FunctionalScript or comes in. The demo below lists them all, with what the
compiler prints for each.

The [refused constructs](../todo/refused-constructs.md) register gives every
refusal a **Why**: **design** when it is meant to last, as for
[`in`](../operators/in/README.md); **planned** when a record proposes
admitting it; and **open** when only the whitelist refuses it. This page is
the open rows, the ones still waiting for a language designer's decision.

## Examples

The demo fetches the register and keeps its open rows, so it lists what the
register says on this build, with nothing here to keep in step. For each row it
shows the register's construct and the record it names, if any, and compiles a
small module that writes the construct, from
[`samples.f.mjs`](./samples.f.mjs), named after the row's ID. It says so when
the compiler accepts a sample, when an open row has no sample, or when a
sample's row is no longer open, since each means the page and the register no
longer agree.

The [proof](./proof.f.mjs) checks that every sample is refused, and where
and with which message, so each one pins its row's refusal as the register
asks: a refusal that moves, or changes its message, fails it.

## When a Row Is Decided

The pull request that decides a row changes its **Why** in the register, and
the row leaves this page with it. The same pull request removes the row's
sample here, and the construct gets a page of its own: a refused construct's
page, like [`in`](../operators/in/README.md), when it stays out, or the
feature's page in the specification when it comes in.

## Reference

- [Refused constructs](../todo/refused-constructs.md)
- [Principles](../principles/README.md): the language is a whitelist
