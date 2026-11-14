## Remove forward references from RTTI output renderers

**Priority:** P2
**Status:** wip

### Problem

The JSON Schema and TypeScript output modules are now `.f.mjs` leaves. Their
forward references prevent compiler admission: the recursive JSON Schema
schema refers to `unknownConst`, and the TypeScript printer calls `unionToTs`
before its declaration. Each renderer also has mutually recursive helpers.

### Tasks

- [ ] Order one-way dependencies and express recursive dependencies explicitly
      without changing the public output or type contracts.
- [ ] Remove all runtime forward references in both modules and promote any
      module the linked compiler accepts to `.f.js`, updating its references.
- [ ] Verify existing proofs, coverage, types and affected browser demos.
