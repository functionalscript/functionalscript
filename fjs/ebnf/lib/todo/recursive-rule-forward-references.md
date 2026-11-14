# Preserve recursive grammar identities without forward references

**Priority:** P3
**Status:** blocked

## Problem

The JavaScript and Markdown grammar leaves still require forward references
between distinct, mutually recursive rule functions. JavaScript has the
`templateContent`/`templateAfterDollar` pair and the `content`/`afterStar`/`star`
cycle. Markdown has the `emAfterWord`/`emAfterSpan`/`emAfterSpace` cycle.

These are identities, not merely interchangeable calls: grammar lowering caches
rules by reference, rewrite sets identify rules by reference, and the demos
associate diagram titles and links with the exported rule functions. Moving
declarations cannot remove a cycle. Creating fresh counterpart functions while
expanding a rule does not preserve these identities.

The current compiler admits a function reading its own binding, but rejects
mutually recursive bindings and self references through an aggregate initializer.
Consequently these modules retain `.f.mjs`; #3888 fixes the other supported leaf
rewrites without changing this contract.

## Tasks

- Resolve the cycles once an identity-preserving representation is admitted.
- Verify exported rule identity, parser output, and diagram links before promotion.

## Related

- [Forward-reference proposal](../../../../spec/todo/3140-forward-references.md).
- [Current capture rules](../../../../spec/functions/captures/README.md).
