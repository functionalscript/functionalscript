## Plan shared lazy cells throughout eager operand regions

**Priority:** P2
**Status:** wip

### Problem

Caller-level memo planning inventories statement regions but treats values as
opaque. An operand-owned loop reading a caller's selected lazy value is refused,
as is a computed lazy local inside an operand that depends on that value.
Initializer recipes already have an eager lexical inventory for these regions.

### Tasks

- [ ] Inventory eager operand definitions and loops with resolved lexical scope
      and distinct prepared occurrence identities.
- [ ] Preserve caller/prerequisite sharing and fresh reached local lifetimes.
- [ ] Keep ordinary function bodies, deferred initializers and operand control
      ownership boundaries separate.
- [ ] Replace both refusal fixtures with execution, stable graph round-trip
      and JavaScript/Rust proofs, retaining no-selected-plan identity.

### Related

- [FAST loop construction](../../../../edag/todo/fast-loop-construction.md)
  owns the remaining memo and construction work.
