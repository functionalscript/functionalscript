## Language-feature approval with one designer

**Priority:** P4
**Status:** open

### Problem

A new language feature needs "formal, explicit approval from another language
designer, distinct from the proposer"
([DESIGN.md §12](../doc/DESIGN.md#new-language-features-start-with-a-todo);
[AGENTS.md](../AGENTS.md) repeats it as "another language designer"). The same
section names the designers who may approve, and there is one: "Currently, the
language designer is **`sergey-shandar`**".

For a proposal from anyone else the gate works, and approvals recorded that
way exist, such as [named imports](../spec/named-imports.md). For a proposal
from the one named designer it cannot be met: nobody left is authorized to
approve it, and self-approval "does not count". Neither document says what
happens then.

### Tasks

- [ ] Decide how a proposal from the sole designer is approved — name a
      second designer, or define what counts as approval in that case — and
      write it into DESIGN.md §12

### Related

- [DESIGN.md §12](../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
  — the gate
