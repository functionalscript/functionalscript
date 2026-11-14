## Rest parameter patterns

**Priority:** P2
**Status:** open

### Problem

A function's rest parameter still requires a plain name: `(...args) => args`
is supported, while `(...[a]) => a` and `(...{ length }) => length` are
unsupported by the parameter grammar.

This differs from array rest inside a fixed parameter pattern:
`([a, ...r]) => [a, r]` binds one fixed argument and counts as one toward
the function's `length` and fixed-parameter limit. The `...r` there takes
the remainder of that argument's iterable; a pattern after the parameter
list's `...` would instead destructure the array of remaining arguments.
Approval for the former does not approve the latter.

No grammar or lowering extension is decided here. A future proposal must
preserve JavaScript's parameter counting, binding checks and failure behavior,
and explain its interaction with nested patterns and defaults. Until then,
rest parameters keep their plain-name rule and existing refusals.

### Tasks

- [ ] Propose the supported rest-parameter targets and their grammar,
      binding and lowering, explaining compatibility, benefits and drawbacks.
- [ ] Record explicit language-design approval before implementation.
- [ ] After approval, implement the chosen syntax and prove argument
      collection, nested bindings, duplicate and capture checks, function
      metadata, and refusals outside the approved forms.
- [ ] Update the permanent parameter and destructuring specifications.

### Related

- [Destructuring](../bindings/destructuring/README.md) — fixed patterns and
  the current plain-name rest-parameter rule.
- [Parameters](../functions/parameters/README.md) — argument positions and
  parameter counting.
- [Object rest destructuring](./object-rest-destructuring.md) — a distinct
  unsupported binding operation.
