## Add selective expansion to control graph size

**Priority:** P3
**Status:** open

### Problem

The RTTI demo expands every reachable named schema. Large examples such as
Evaluated EDAG value produce many nodes and recursion arrows, making the
overall structure hard to follow even with improved layout and highlighting.

### Proposal

Let readers expand and collapse individual schema definitions so they can
inspect one branch while keeping the rest compact. Consider a compact initial
view and an expand-all/reset control; decide the initial expansion policy
when implementing the interaction.

Collapsed definitions should remain identifiable references with a clear
indication that more structure is available. Expanding a shared or recursive
definition must preserve its identity and terminate; it must not create an
unbounded copy of the schema.

Keep this a presentation choice: expansion must not change validation,
generated types, or the schema itself. Make the controls usable with a
keyboard and keep their state distinguishable without relying on colour.

### Validation

- Evaluated EDAG value and JSON Schema can be explored one branch at a time.
- Shared and recursive definitions remain recognizable when collapsed and
  expand without duplication or infinite recursion.
- Port/title highlighting continues to describe the visible connections.

### Related

- [Schema demo renderer](../module.f.mjs)
- [Shared graph renderer](../../../website/demo/graph/module.f.mjs)
