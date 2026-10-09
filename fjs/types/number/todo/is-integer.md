## Implement isInteger with numeric operators

**Priority:** P2
**Status:** wip

### Problem

`js/array_index` reaches `Number.isInteger` through `isUintUpTo` in
`types/number`. Integer checks can use the existing language operators instead
of requiring another built-in to be admitted by the compiler.

### Proposal

Add a dependency-free `types/number/is_integer` module exporting `isInteger`:
`typeof n === 'number' && n % 1 === 0`. It answers a boolean, accepts both
zeros and integral numbers beyond the safe-integer range, and refuses
non-numbers, fractions, NaN, and infinities without coercion.

Use it directly in `js/array_index`, preserving the array-index bounds and
the canonical `String(i) === key` round-trip. Reuse it in `types/number`
instead of the private `Number.isInteger` alias.

### Tasks

- [ ] Add the compiler-supported integer predicate and its complete proof.
- [ ] Use it in `js/array_index` and `types/number`, preserving their behavior.

### Related

- [Repository compiler-compatibility migration](../../../../todo/fjs-nanvm-integration.md)
  — removing a built-in dependency is a step toward compiler acceptance.
