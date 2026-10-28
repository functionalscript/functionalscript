## Array holes

**Priority:** P5
**Status:** open — speculative

### Problem

Valid FunctionalScript builds no array with a hole: the elision `[1, , 3]` is
refused by design ([an array hole is refused](../values/arrays/holes/README.md)),
and nothing else in the language originates one. Code written in
FunctionalScript relies on that, the rtti readers among it: an array with a
hole is outside what they read
([what the readers assume of a value](../../fjs/rtti/guide/readers/assumptions/README.md)).

That is a restriction on harmless JavaScript, so
[DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
asks for it to stay justified rather than assumed.

### Tasks

- [ ] Investigate whether supporting holes is worth it: what a hole would let
  FunctionalScript code say that `undefined` does not, and what it costs. A
  hole changes the VM: an array there has no empty item, so its
  representation and every array operation would have to tell an empty item
  from a held `undefined`. Every module that now assumes dense arrays would
  need auditing too.
- [ ] Record the outcome: a proposal, which needs the §12 approval, or a
  reasoned refusal on the arrays page.
