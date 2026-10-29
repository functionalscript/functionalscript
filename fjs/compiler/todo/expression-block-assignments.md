## Allow assignments in expression blocks

**Priority:** P3
**Status:** wip

### Problem

An immediately invoked arrow function is normalized to an expression block,
but assigning an outer variable from that block is refused. The compiler
must preserve the resulting binding versions both inside the block and in
the surrounding continuation.

### Tasks

- [ ] Specify source admission and immutable binding propagation.
- [ ] Implement block assignments and cover evaluation order and lazy paths.
- [ ] Preserve assignments through serialization and source round trips.

### Design approval

`sergey-shandar` approved allowing assignments in code blocks and serialization
to that spelling in the [working session](https://chatgpt.com/local/01a185f1-43c3-7453-babf-5d7d9cc48000).

### Related

- [Source normalization](../../js/ast/sugar/README.md).
- [Source bindings](../../../spec/bindings/variables/README.md).
