# Boolean conversion through the common runtime

**Priority:** P2
**Status:** wip

### Proposal

Admit `Boolean(value)` as a conversion operator with the EDAG form
`['Boolean', value]`. Its only semantic body is the common runtime's
`Boolean: value => !!value`, invoked by represented interpreters and compiled
NaNVM code through the existing runtime dispatch. It does not call conversion
methods on objects. Primitives follow JavaScript truthiness; arrays, objects
and functions are true, including represented values.

`Boolean()` supplies `undefined` to that same body. Evaluate a supplied operand
once, propagating its failure before runtime lookup or invocation. Admit one
plain argument or no arguments; refuse multiple arguments and argument spreads
as the existing conversion operators do.

Reserve `Boolean` with the existing conversion names: it is not a binding,
first-class function or constructor. Bare, detached, member and guarded uses
of the global name remain refused; ordinary object keys named `Boolean` are
unchanged. Source and graph writers retain the conversion spelling.

### Benefits and drawbacks

This restores familiar JavaScript conversion syntax, unblocks modules that
already use `Boolean`, and keeps one authored implementation across executors.
There is no dedicated native Boolean conversion implementation to maintain.
The cost is another admitted conversion tag, runtime dependency and reserved
global name. As with `Number` and `String`, shadowing the global and JavaScript's
extra-argument, spread, guarded, detached and constructor forms remain outside
the admitted operator contract.

### Approval

Requested by language designer `sergey-shandar` in the
[working session](https://chatgpt.com/local/6af401d2-2f04-8191-9c7c-c4ddba48e03b)
on 2026-11-11: introduce `Boolean` as an operator implemented by `!!` in the
common runtime. This explicit implementation request is approval under
[DESIGN.md section 12](../../doc/DESIGN.md#new-language-features-start-with-a-todo).

### Tasks

- [ ] Admit the source operator and record its implemented contract.
- [ ] Add the EDAG vocabulary, common body and shared interpreter dispatch.
- [ ] Route Rust generation through the same body, with no native duplicate.
- [ ] Prove truthiness, evaluation/failure order, runtime dispatch and syntax
      boundaries across executors; add a compiler demo and corpus fixtures.
- [ ] Regenerate outputs, migrate newly accepted leaves and refresh the audit.
