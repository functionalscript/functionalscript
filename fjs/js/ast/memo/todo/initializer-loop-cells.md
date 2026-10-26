## Share cells declared inside initializer-owned loops

**Priority:** P2
**Status:** open

### Problem

Recipe-local cells are selected outside initializer-owned loop bodies. A lazy
declaration inside such a loop therefore retains the existing operand-loop
boundary. First demanding a return-bearing local initializer is explicitly
refused rather than propagated to its source function.

For example, this structured FAST has an owning return at the demand of `inner`:

```text
lazy outer = block {
    loop L() -> out {
        lazy inner = block { return owner(7) }
        break L(inner)
    }
    yield out
}
return owner(outer)
```

The current constructor refuses it with a nonlocal value-region completion
diagnostic. Pure initializer-owned loops can return, and cells declared directly
in recipes already share correctly; their combination with loop-local demand
cells needs its own lifetime and transport support.

### Tasks

- [ ] Select initializer-loop cells with fresh lifetimes at reached declarations.
- [ ] Carry their normal state and source-owned returns through nested helpers.
- [ ] Preserve skipped demands, prerequisite identity and exact owner/target rules.
- [ ] Cover normal/return paths, escaping captures and stable graph round trips
      across JavaScript and Rust.

### Related

- [FAST loop construction](../../../../edag/todo/fast-loop-construction.md)
  tracks the remaining general construction and memo lifetime work.
