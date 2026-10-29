## Allow assignments in expression blocks

**Priority:** P3
**Status:** wip

### Problem

An immediately invoked arrow function is normalized to an expression block,
but assigning an outer variable from that block is refused. The compiler
must preserve the resulting binding versions both inside the block and in
the surrounding continuation.

### Proposal

Treat a source expression block as an execution region, rather than a capture
boundary. Permit assignments to enclosing variables in blocks and in direct
immediate calls that normalize to blocks. Preserve ordinary function capture
admission: a function held as a value still cannot capture a reassigned binding.
The existing admission rules for constants and initialized variables continue
to apply.

Normalize each write to a fresh immutable FAST binding. A block exports its
expression result and the latest versions of any enclosing bindings it writes.
Its continuation reads those versions. Sequential operands retain their written
evaluation order; conditional and optional operands export updates only from
the selected path. A loop carries updates from every condition evaluation,
including its final false test. Earlier evaluations, failures and shared
identities must survive even when a later write overwrites a value.

Reuse the common operand sequencer for member lookup, spread expansion, object
key conversion and optional chains. Keep no-write expressions on their existing
normalization path. FAST-to-EDAG consumes explicit immutable results rather than
recovering source assignments.

The serializer may spell expression blocks as immediately invoked arrow
functions and use assignments where target preparation requires them. Generated
source must recompile with the same behavior and sharing. No requirement
preserves the source's original variable names or assignment spelling.

Direct calls that require an ordinary invocation boundary retain their existing
capture restriction; allowing outer writes in an arbitrary stored function is
outside this proposal.

### Benefits and drawbacks

This preserves familiar JavaScript assignment semantics in lexical execution
regions and removes a restriction imposed by the current normalization API.
It makes generated expression blocks usable without introducing shared mutable
cells or new graph operations. The cost is explicit binding-state propagation
through value evaluation, lazy joins and loop conditions, with proof obligations
for source order, source diagnostics and serializer round trips.

### Tasks

- [x] Specify source admission and immutable binding propagation.
- [ ] Implement block assignments and cover evaluation order and lazy paths.
- [ ] Preserve assignments through serialization and source round trips.

### Design approval

`sergey-shandar` approved allowing assignments in code blocks and serialization
to that spelling in the [working session](https://chatgpt.com/local/01a185f1-43c3-7453-babf-5d7d9cc48000).

### Related

- [Source normalization](../../js/ast/sugar/README.md).
- [Source bindings](../../../spec/bindings/variables/README.md).
