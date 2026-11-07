## `normalizedSwitch` and `statefulSwitch` share their tail

**Priority:** P4
**Status:** open

### Problem

`normalizedSwitch` and `statefulSwitch` in [`module.f.mjs`](../module.f.mjs)
lower a `switch` to a loop. They differ in how the discriminant and the case
labels are evaluated, stateless against state-threading, and agree on
everything after: the `completed` projection of a case that falls out, the
`normal` test over the alternatives, the `results` bindings, the loop
record with its fall-through `throw`, and the `Normalized` result with its
`block`, `environment`, `normal`, `hasLoopExit` and `hasFunctionExit`
fields. Both spell that tail in full:

```js
const completed = made => made.normal ? { ...made.block, exit: ['break', source.target, sources.map(source => lookup(made.environment, source))] } : made.block
…
const normal = alternatives.some(made => made.normal || hasLoopTransfer(made.block, source.target))
```

The switch-as-loop encoding is one decision written twice; a change to it,
or to `Normalized`, is made twice.

### Proposal

A private `switchLoop(source, sources, alternatives, statements,
environment): Normalized` holding the tail; each of the two functions
shrinks to its evaluation of the discriminant and labels and one call.

### Tasks

- [ ] `switchLoop`; both callers over it.
- [ ] `tsc` and the suite under `fjs/js/ast/sugar`.
