## Highlight source fields with their references

**Priority:** P3
**Status:** wip

### Problem

The RTTI graph traces a reference cell but leaves the adjacent field name
inactive and unhighlighted. This hides which field owns the selected reference.

### Tasks

- Let either source cell activate its connection and outline both cells as
  one rounded block, matching the approved light/dark preview.
- Keep destination titles and incoming-connection title hover consistent.
- Keep inline-only values inactive; retain keyboard focus and empty-space
  behavior. Leave compiler EDAG highlighting for a separate PR.
- Verify graph proofs and RTTI browser interactions in both themes.
