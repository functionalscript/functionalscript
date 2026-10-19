## The delta chain's ceiling

**Priority:** P3
**Status:** open — merged as a stopgap; the number awaits the owner

### Problem

[`maxDeltaBytes`](../module.f.mjs) is 8 MiB. [`fjs/git/packstore`](../../packstore/module.f.mjs)
holds a delta chain's deltas, and the base they are applied to, as dense
arrays (a number a byte, about eight bytes of heap a byte), and a delta is
applied over arrays too, so a chain costs memory in proportion to what its
entries *declare*. The ceiling is a budget for the whole chain, deltas and base
together, and it is decided from the declared sizes before anything is
inflated, so a hostile pack cannot make the reader allocate first and refuse
after. A chain over it is refused (`ERR_PACK_ENTRY`, naming the room that was
left), never answered with a wrong object.

Git has no such limit. The number is what this layer can hold without asking a
pack for gigabytes; before the FunctionalScript inflater it was 128 KiB, the
size of a `Vec`. It is a policy number, and not one the format gives.

An object stored whole, loose or packed, has no ceiling: it is a list over the
chunks it inflated to, about a byte a byte.

### Proposal

Keep 8 MiB until [dense-delta](./dense-delta.md) lifts the ceiling by holding a
base and a target as the chunks the inflater makes. Then the number stops being
about this representation and becomes a limit on memory, if one is wanted.

### Tasks

- [ ] The owner sets the number, or confirms 8 MiB. A larger one is one constant
      and a longer wait for a hostile pack to be refused; a smaller one refuses
      deltas that real repositories hold.
- [ ] The wording of the refusal, which reports the room left in the chain
      (`more than the N a delta chain is built from`), is the owner's to
      accept or change.
- [ ] [dense-delta](./dense-delta.md) lands, and this file is deleted with the
      constant, or restated as a memory limit.

### Related

- [dense-delta](./dense-delta.md) — what lifts the ceiling.
- [chunked-push-inflater](../../../zlib/todo/chunked-push-inflater.md) — the
  other decision the same work left.
- [inflate](../../../../todo/inflate.md) — the task.
