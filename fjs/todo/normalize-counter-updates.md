## Normalize numeric counter updates

**Priority:** P3
**Status:** wip

### Problem

The current FJS syntax parser refuses update operators used by repository
counter statements and classic `for` clauses. Known numeric counters can use
the supported compound assignment spellings instead.

### Tasks

- [ ] Inventory executable updates and confirm each counter's numeric type.
- [ ] Replace discarded-result updates with `+=` or `-=`, using `1` for
      Number counters and `1n` for BigInt counters.
- [ ] Preserve parser fixtures, generated source and consumed update results.
- [ ] Run the checks required by the changed modules.
