## Refuse out-of-domain repetition bounds

**Priority:** P2
**Status:** open

### Problem

`repeat` carries its bounds verbatim and checks nothing, so every one of these
returns an ordinary-looking rule:

```js
repeat(-1, 0)('x')()   // ['repeat', -1, 0, 'x']
repeat(1.5, 2)('x')()  // ['repeat', 1.5, 2, 'x']
repeat(3, 2)('x')()    // ['repeat', 3, 2, 'x']
```

ebnf-front-end settles the domain: `min` is
a non-negative integer, `max` is a non-negative integer or `Infinity`, and
`min <= max` — "`min > max` is an error" in those words. Nothing downstream
enforces it either, because there is no lowering yet, so a malformed grammar
is built and stays plausible until whatever consumes it first meets a rule
that cannot match. Refusing at the constructor points at the call site that
wrote the bounds, which is the only place the mistake is legible.

This is the "answered with a plausible wrong value" case
[AGENTS.md §1](../../../AGENTS.md#1-workflow) names, so it wants a fix rather
than a long life as an issue.

### Proposal

Assert the bounds in `repeat`, the one constructor the others are partial
applications of, so `option`, `times`, `repeatFrom` and `repeatFrom0` inherit
the check. `max` accepts `Infinity`; `min` does not, since an unbounded
minimum matches nothing.

### Tasks

- [ ] Assert `min` is a non-negative integer, `max` is one or `Infinity`, and
      `min <= max`.
- [ ] Cover each refusal under the proof's `throw` key, and keep the branch
      coverage the assert adds at 100%.

### Related

- ebnf-front-end — defines the bounds and
  calls `min > max` an error.
- [`../module.f.mjs`](../module.f.mjs) — `repeat` and its partial applications.
- [DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle) —
  refuse what you cannot handle.
