## Select caller cells required by deferred initializer loops

**Priority:** P2
**Status:** wip

### Problem

When the only helper crossing is inside a lazy initializer, caller planning has
no eager crossing to select the owner and its prerequisite cells. Lowering the
initializer's loop then treats a caller-owned lazy value as an unavailable
external recipe. For example, a lazy `owner` whose loop reads lazy `shared`
cannot yield `[owner, shared]` without another eager loop selecting them first.

### Tasks

- [ ] Detect helper crossings in deferred initializers and select their owning
      caller roots and prerequisites without demanding their values.
- [ ] Preserve lexical aliases, transitive and nested recipes, optional skips,
      zero iterations, later caller identity and fresh invocation lifetimes.
- [ ] Keep ordinary function and true external-provenance boundaries intact.
- [ ] Cover stable graph round trips and JavaScript/Rust execution.

### Related

- [FAST loop construction](../../../../edag/todo/fast-loop-construction.md)
  owns the remaining memo and construction work.
