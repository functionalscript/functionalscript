## Allow equal-content allocations to share identity

**Priority:** P3
**Status:** open — proposed language change, pending design approval

### Problem

FunctionalScript currently preserves fresh JavaScript allocation identities in its JS-compatible executors. Decide whether fresh allocation and full content identity can be two implementations of one language contract.

### Proposal

Permit independently constructed immutable objects with equal content to share an identity. Recognize deep structural equality as a pattern instruction for portable data comparisons. Specify the consequences alongside the existing exception for function text.
