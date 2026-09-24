## Serialize arity and complete arguments

**Priority:** P3
**Status:** open

### Scope: an alternative, not a parameter blocker

The [named-and-rest parameter proposal](./3120-parameters.md) now separates
`['arg', N]` from `['rest']` and uses pre-generated arrow factories. It does
not expose the original supplied argument count inside a positive-length
fixed prefix. This file tracks the stronger, alternative requirement below;
it is not a prerequisite for implementing that proposal.

No representation change has landed merely by updating these TODOs. The
current zero-arity function format and its `['args']` behavior remain intact
until the parameter plan's coordinated migration.

### Problem

The earlier hypothetical format combined positive declared arity with the
complete supplied argument list. A graph such as
`['=>', 2, ['[]', []], ['.', ['args'], 'length']]` would need a callable `f`
with `f.length === 2`, `f() === 0`, `f(undefined) === 1` and `f(1, 2, 3) === 3`.
This is not a valid example of the new `arg`/`rest` proposal.

A named-plus-rest arrow cannot recover that complete list: rebuilding
`[a, b, ...rest]` pads omitted fixed positions with `undefined`. That is a
problem for this stronger contract, not for the new parameter-binding contract.
The [length-pattern proposal](./3130-function-length-pattern.md) is one
possible mechanism for the stronger contract.

### Tasks

- [ ] Revisit only if positive arity plus the complete original supplied list
      is needed independently of the named-and-rest parameter work. Obtain an
      explicit language-design decision before restoring that EDAG capability.
- [ ] If retained, propose a source representation preserving both properties,
      state its benefits and costs, and reconcile it with the parameter plan;
      do not silently give `['rest']` or `['arg', N]` different meanings.
- [ ] Prove omitted, explicit `undefined` and extra-argument round trips for
      any such extension. Unsupported legacy/proposed graphs must be refused,
      not normalized and described as lossless.

### Related

- [Review finding](https://github.com/functionalscript/functionalscript/pull/2133#discussion_r4054015547)
  — the complete-list writer obstruction that motivated the earlier task.
- [Serialization](./serialization.md#function-text-and-serialization) —
  callable serialization and default function text have separate open questions.
