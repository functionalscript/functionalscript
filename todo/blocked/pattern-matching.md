## Pattern matching

**Priority:** P3
**Status:** blocked

### Trigger

Unblocked when the [TC39 pattern matching proposal](https://github.com/tc39/proposal-pattern-matching)
reaches Stage 4 and the standardized syntax is supported by FunctionalScript's
declared JavaScript execution environment, without transpilation or experimental
flags.

### Problem

Branching on tagged values or nested object and array shapes requires repeated
tests and property access. Pattern matching could express those cases and their
bindings together.

### Proposal

Evaluate the standardized ECMAScript feature for FunctionalScript, preserving
purity, determinism, and JavaScript behavior for admitted programs. Do not
implement today's draft syntax or introduce a FunctionalScript-only variant.
This TODO neither directs nor blocks current development.

**Benefits:** clearer structural branching and less repeated testing and
binding code, using syntax shared with JavaScript.

**Drawbacks:** a larger grammar and additional rules for matching, bindings,
and evaluation order. Custom matchers and other observable operations need
compatibility and purity review rather than silently different semantics.

### Tasks

- [ ] Review the final specification and native runtime support; propose a
      compatible subset with examples covering tagged values, nested patterns,
      bindings, evaluation order, equality, and unmatched inputs.
- [ ] Obtain formal, explicit approval from another language designer before
      implementation, recording the designer and approval link here as required
      by [the language-design policy](../../doc/DESIGN.md#new-language-features-start-with-a-todo).
- [ ] If approved, add the specification, parser/compiler support, and proofs
      for the admitted subset together.

### Related

- [ECMAScript proposals backlog](../../spec/todo/README.md#4-ecmascript-proposals).
- [JavaScript compatibility](../fjs-javascript-compatibility.md).
