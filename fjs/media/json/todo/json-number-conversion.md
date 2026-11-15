# Use FJS number conversion for validated JSON numbers

**Priority:** P3
**Status:** wip

The standard JSON codec receives complete, valid number lexemes from its
parser, but converts them with the unsupported `parseFloat` global. Use
`Number(lexeme)`, preserving the codec's rounding, signed zero, overflow and
underflow behavior.

## Tasks

- Replace the conversion and verify the existing numeric-policy proofs.
- Promote the accepted module and any accepted parents to `.f.js`, updating
  their references.
- Run scoped proofs, coverage, type checking, compilation and website checks.
