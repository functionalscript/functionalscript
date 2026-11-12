## Object rest destructuring

**Priority:** P2
**Status:** open

### Problem

Object rest binding remains unsupported: `const { a, ...r } = value;` is
refused, including inside a fixed parameter pattern. Array rest support does
not provide the object operation: an array suffix can be sliced, but object
rest must copy the source's own enumerable string properties except the
selected keys.

A future design must preserve JavaScript's nullish refusal, including for
`const { ...r } = null;`, rather than silently produce an empty object. It
must specify exclusion and property order, primitive sources, and the
existing binding and property-name checks described by
[destructuring](../bindings/destructuring/README.md).

No implementation or lowering is decided here. Existing enumeration helpers
may supply part of the operation, but whether to compose them, add a helper,
or use another representation requires a proposal. The array-rest approval
does not grant language-design approval for object rest.

### Tasks

- [ ] Propose the supported object-rest syntax, semantics and lowering,
      explaining JavaScript compatibility, benefits and drawbacks.
- [ ] Record explicit language-design approval before implementation.
- [ ] After approval, implement binding and executor support as needed, with
      proofs for excluded keys, enumeration order, nullish and primitive
      sources, nested patterns, and existing declaration checks.
- [ ] Update the permanent destructuring specification when supported.

### Related

- [Destructuring](../bindings/destructuring/README.md) — current binding rules.
- [Computed binding keys](./computed-binding-keys.md) — separately unsupported
  keys whose treatment a future exclusion design must account for.
- [Rest parameter patterns](./rest-parameter-patterns.md) — a separate grammar
  limitation; supporting object rest does not approve it.
