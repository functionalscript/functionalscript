## Prove recipe placement by differential evaluation

**Priority:** P2
**Status:** open

### Problem

[`_joinResults`](../module.f.js) decides where a deferred recipe may be
required. Each rule is proved on the inputs someone thought of. The defects
found in those rules so far were all found another way: a block that
evaluates successfully before the pass must evaluate to the same value after
it, checked over generated blocks. That check found a read inside a loop's
body taken for a first demand, and has found nothing in the rules written
since. It is a host script outside the repository, so nothing reruns it.

### Proposal

A proof that generates FAST blocks from a seed and compares evaluation
before and after the pass, as `evaluate` in [`proof.f.js`](../proof.f.js)
does for single cases. The generator needs what the rules distinguish: one
recipe that fails when evaluated, selections on a parameter, optional calls,
blocks that return, statements with an arm that leaves, loops with `break`
and `continue`, and a binding declared anew.

A block whose value regions hold a nonlocal transfer makes `fromFast` throw
`nonlocal transfers in value regions require structured completion lowering`
from inside the pass. The generator has to leave those out or the proof has
to expect them; about one generated block in six was one.

### Tasks

- [ ] A seeded generator in FunctionalScript.
- [ ] The proof, with a number of blocks that keeps it under a second.
