## A closure's text, rendered from the graph

**Priority:** P2
**Status:** open

### Problem

The specification adopts a function-source representation: in VM
execution, `String(f)` and every admitted conversion that reaches it give
source reconstructed from the function's EDAG
([`spec/README.md`](../../../../spec/README.md#function-source-representation-exception)).
A function value in the JavaScript executors is a closure record
([`../module.f.mjs`](../module.f.mjs)), whose host string is
`[object Object]`, so the operations that would read a closure's text are
refused — `String(f)`, `f + x` and `x + f`, and `<`, `<=`, `>`, `>=`
against a string or another closure — rather than answered with that. A numeric coercion and
an order against a non-string answer as JavaScript does for any function
without reading the text, and stay.

The writer in [`fjs/fsc/serializer`](../../../fsc/serializer/module.f.mjs)
already renders a function from its graph; the executors do not reach it,
since `fjs/fsc` is built over `fjs/edag` and not the other way.

### Proposal

A renderer of a closure the operations can call — the writer's function
text over the record's body and frame, in a module both can import — and
the three refusals become the specification's text. Until then a refusal
is the honest answer.

### Tasks

- [ ] The function text of a closure record, for amnesia's `Exp` body and
  memo's entry body alike.
- [ ] `String`, `+` and the four orders answer it; the `throw.closureText`
  cases in [`../../amnesia/proof.f.mjs`](../../amnesia/proof.f.mjs) become
  value cases.
