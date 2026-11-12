## Computed binding keys

**Priority:** P2
**Status:** open

### Problem

Object binding patterns admit only a standalone string or number literal
inside a computed key: `{ ["a"]: t }` and `{ [3]: t }`. Other forms remain
unsupported, including `{ [k]: a }`, `{ [Number(i)]: a }`, and the grouped
literal `{ [(3)]: a }`.

The parser resolves a statement's initializer through an explicit resolution
stack. A computed binding key introduces another expression to resolve within
that statement, potentially at every nested pattern. The existing literal
case requires no such resolution. Supporting more keys therefore needs a
design for resolution and binding, not just a wider grammar production.

Which additional keys to accept and how to lower them remain undecided. A
proposal must preserve the contracts of
[property access](../property-access/README.md): numeric conversion keys
accepted by an access are not automatically accepted in a binding pattern,
and dynamic keys must not silently bypass prototype-name guards or the closed
built-in namespaces. The [entry helper](../property-access/entries/README.md)
already supplies a separate operation for arbitrary runtime keys.

The array-rest approval does not grant language-design approval for this
extension.

### Tasks

- [ ] Propose the accepted key forms, evaluation and binding rules, and
      resolution-stack changes, explaining benefits and drawbacks.
- [ ] Record explicit language-design approval before implementation.
- [ ] After approval, implement the chosen forms and prove nested resolution,
      current access and prototype guards, and named refusals for forms that
      remain unsupported.
- [ ] Update the permanent destructuring specification and compiler guidance.

### Related

- [Destructuring](../bindings/destructuring/README.md) — accepted literal keys
  and current refusals.
- [Object rest destructuring](./object-rest-destructuring.md) — property
  exclusion is separate work and must not silently decide computed-key rules.
