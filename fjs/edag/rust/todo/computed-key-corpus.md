## Computed keys in corpus expressions

**Priority:** P3
**Status:** open

### Problem

The shared FAST pipeline now supports computed object keys in `nodeExpr`
and `expExpr`. Every generated case runs in the common Result-returning
`scope`, so nested key conversions can propagate their failures there.
The former `nestsOperation` refusal and separate corpus placement policy
have been removed.

The current shared corpus does not produce computed-key object construction.
Direct JavaScript proofs pin its prepared Rust spelling, including nested
operands, but generated Rust execution still needs successful and throwing
key-conversion cases. Shared-value initializers also need an explicit
Result boundary if that input vocabulary is extended to computed keys: their
bindings are established in the group's `run`, outside individual case scopes.

### Tasks

- [ ] Add a generated corpus fixture path for computed object construction;
      keep its conversion within the existing Result-returning case scope.
- [ ] Define the Result boundary for computed shared-value initializers before
      extending that input vocabulary.
- [ ] Compile and run generated corpus cases for successful and throwing
      conversions, including nested operands and lazy branches. Preserve
      operand evaluation and key-conversion order.

### Related

- [Rust admission adapter](../module.f.mjs) — `expExpr`, `scope`, `bindingLine`.
- [Corpus generator](../../../nanvm/rust/module.f.mjs) — `caseText`, `groupFile`.
- [PR review](https://github.com/functionalscript/functionalscript/pull/2528#discussion_r4174133383).
