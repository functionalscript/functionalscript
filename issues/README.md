# Issues

One file per open issue, named `YMD-kebab-slug.md` — three Crockford base32 digits
encoding the creation date, followed by a short kebab-case slug.
Done issues are deleted — but before deleting, ensure design and design decisions are
captured in the codebase: architectural choices and the *why this / why not that* rationale
belong in the relevant `README.md` files; API shape, invariants, and non-obvious constraints
belong in JSDoc on the affected `module.f.ts` exports. The issue file is a scratchpad;
the code and its docs are the permanent record.

The `issues/` directory is the index — browse it directly.

## Date prefix encoding

Use the current **UTC/GMT** date when creating a new issue file.

Each filename starts with three [Crockford base32](https://www.crockford.com/base32.html) digits:

| Digit | Encodes | Range |
|-------|---------|-------|
| Y | year − 2020 | `0`=2020 … `6`=2026 … `Z`=2051 |
| M | month | `1`–`9`, `A`=Oct, `B`=Nov, `C`=Dec |
| D | day | see table below |

### Day encoding

| 1–9 |      | 10–19 |      | 20–29 |      | 30–31 |      |
|-----|------|-------|------|-------|------|-------|------|
|     |      | 10    | `A`  | 20    | `M`  | 30    | `Y`  |
| 1   | `1`  | 11    | `B`  | 21    | `N`  | 31    | `Z`  |
| 2   | `2`  | 12    | `C`  | 22    | `P`  |       |      |
| 3   | `3`  | 13    | `D`  | 23    | `Q`  |       |      |
| 4   | `4`  | 14    | `E`  | 24    | `R`  |       |      |
| 5   | `5`  | 15    | `F`  | 25    | `S`  |       |      |
| 6   | `6`  | 16    | `G`  | 26    | `T`  |       |      |
| 7   | `7`  | 17    | `H`  | 27    | `V`  |       |      |
| 8   | `8`  | 18    | `J`  | 28    | `W`  |       |      |
| 9   | `9`  | 19    | `K`  | 29    | `X`  |       |      |

Example: 2026-05-29 → `65X`. New issue created today: `65X-kebab-slug.md`.

## Template

```md
# YMD-slug. Title

**Priority:** P1 | P2 | P3 | P4 | P5
**Status:** open | wip | blocked | on-hold | irrelevant | won't fix
**Blocked by:** [iYMD-kebab-slug](./YMD-kebab-slug.md)

## Problem

Why this needs to be addressed.

## Proposal

What we plan to do. Omit if no design yet.

## Tasks

- [ ] concrete step 1
- [ ] concrete step 2

## Related

- [iYMD-slug](./YMD-slug.md) — relationship note
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
| `irrelevant` | Superseded, obsolete, or no longer applicable; keep only if the historical context is useful |
| `won't fix` | Deliberately will not be implemented; record the reason in the file |

Done → set **Status: done** in the file. Done and won't-fix issues are deleted occasionally in a cleanup pass — do not delete them immediately.

## Open Issues

- [i66A-unified-operator-tests](./66A-unified-operator-tests.md) — single `module.f.ts` as source of truth for operator tests; generate `test.rs` and `proof.f.ts` from it.

## Language Specification

See [lang/README.md](./lang/README.md).
