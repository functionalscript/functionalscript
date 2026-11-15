## Compile pack directory names

**Priority:** P2
**Status:** wip

### Problem

The pack store is a leaf module, but its directory-entry `.name` reads use a
property the FJS compiler prohibits.

### Proposal

Read required directory-entry names with `entry` and `assertNotNullish`, keeping
the existing file filtering, path construction and refusal behavior. Rename
modules the compiler then accepts to `.f.js` and update their references.

### Tasks

- [ ] Replace the prohibited name reads, promote accepted modules and verify
      scoped proofs, coverage, types and compilation.

### Related

- Stacked on [#3906](https://github.com/functionalscript/functionalscript/pull/3906).
