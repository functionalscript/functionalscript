## The default `toSorted` converts every element up front, so a different throw surfaces than in V8

**Priority:** P5
**Status:** open

### Problem

`Array::to_sorted` (`vm/array/to_sorted.rs`) without a comparator sorts by
each element's `ToString`. It converts every defined element once, in array
order, before the first comparison. V8 converts lazily, inside each
comparison, in the order its own sort algorithm compares.

Nothing pure can tell the two apart except through a conversion that throws:
how many times an element is converted is invisible, and a conversion that
does not throw gives the same answer both ways. What differs is **which**
throw surfaces when several elements throw. With two elements whose
`toString` throws `"a"` and `"b"`, V8 throws `"b"` and NaNVM throws `"a"`.
A lone defined element is never converted in either, so `[x, undefined]`
answers and the guard test in `to_sorted.rs` pins that.

This is not a deviation from ECMAScript. `SortIndexedProperties` performs an
implementation-defined sequence of calls to `SortCompare`, so which
conversion runs first is the engine's to choose. The `to_sorted` JSDoc
already says so. It is a difference from V8, which matters only to someone
comparing the two engines' throws, and the corpus cannot pin it, because the
host's answer is V8's order and not a contract.

### Proposal

Do nothing. This is closest to a won't-fix, and is filed so the choice is
recorded rather than rediscovered:

- Matching V8 means converting inside each comparison in V8's comparison
  order, which is replicating its sort algorithm, not just its conversion
  point. That is more code and a worse dependency than the stable merge sort
  the file keeps, for a difference nobody can observe without a throwing
  `toString` on two or more elements.
- Converting lazily with a memo gives no more V8 fidelity than the up-front
  pass unless the comparison order matches too.

If this is closed as won't-fix, the reason already lives in the JSDoc of
`Array::to_sorted`, so the file is deleted with no further record.

### Tasks

- [ ] Decide: close as won't-fix, or match V8's comparison order.

### Related

- [to-primitive.md](./to-primitive.md) — the conversion `to_sorted` calls for
  each element, whose own throws this ordering decides between.
- [array-deep-nesting.md](./array-deep-nesting.md) — the other cost of the
  default `toSorted` converting each element to a string.
