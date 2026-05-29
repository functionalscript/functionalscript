# Issues

One file per open issue, named `NNN-kebab-slug.md` (sequential number, short kebab-case slug).
Done issues are deleted — but before deleting, ensure design and design decisions are
captured in the codebase: architectural choices and the *why this / why not that* rationale
belong in the relevant `README.md` files; API shape, invariants, and non-obvious constraints
belong in JSDoc on the affected `module.f.ts` exports. The issue file is a scratchpad;
the code and its docs are the permanent record.

The `issues/` directory is the index — browse it directly.

## Template

```md
# NNN. Title

**Priority:** P1 | P2 | P3 | P4 | P5
**Status:** open | wip | blocked | on-hold
**Blocked by:** [iNNN](./NNN-slug.md)

## Problem

Why this needs to be addressed.

## Proposal

What we plan to do. Omit if no design yet.

## Tasks

- [ ] concrete step 1
- [ ] concrete step 2

## Related

- [iNNN](./NNN-slug.md) — relationship note
```

### Priority scale

| Level | Meaning |
|-------|---------|
| P1 | Blocking — nothing else can proceed |
| P2 | High — current sprint |
| P3 | Normal — default |
| P4 | Low — nice to have |
| P5 | Minimal — do only if it falls in our lap |

### Status values

| Value | Meaning |
|-------|---------|
| `open` | Not yet started |
| `wip` | Work in progress |
| `blocked` | Waiting on another issue (pair with **Blocked by**) |
| `on-hold` | Intentionally deferred |

Done → delete the file. Will-not-fix → delete the file (record the decision in the closing commit message).

## Language Specification

See [lang/README.md](./lang/README.md).
