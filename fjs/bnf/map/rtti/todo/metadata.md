## Generalize mapping metadata

**Priority:** P3
**Status:** open

### Problem

`checkMap` currently fixes an unmapped rule's output to the existing
`Ast<CodePointMeta<unknown>>` shape. This proves rule input/output RTTI without
deciding how metadata from several children becomes one parent value.

### Proposal

Parameterize mapping construction by a metadata type and its lawful monoid.
Use the identity for empty sequences and zero repetitions, combine child
metadata in grammar order, and let an explicit transformer choose its output
metadata. Move `CodePointMeta` to the shared matcher layer when both parser
backends consume the same metadata-carrying leaves.

### Tasks

- [ ] Define the metadata monoid in the mapping API.
- [ ] Generalize the implicit AST RTTI and builders from `CodePointMeta<unknown>`.
- [ ] Use the same metadata-carrying input in the descent and LL(1) backends.
