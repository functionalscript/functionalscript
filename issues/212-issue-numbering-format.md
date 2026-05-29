# 212. Issue file numbering format

**Priority:** P4
**Status:** open

## Problem

The current `NNN-kebab-slug.md` sequential numbering requires looking up the highest
existing number before creating a new issue. With many contributors or rapid issue
creation this causes coordination friction and occasional conflicts.

## Proposal

Use a **3-character Crockford base32 date prefix** `YMD-kebab-slug.md` for all new
issues. Existing `NNN` files are not renamed.

Each component is a single Crockford base32 digit:

| Component | Range | Encoding |
|-----------|-------|----------|
| Y | year offset from 2020 | `0`=2020 … `6`=2026 … `9`=2029, `A`=2030 … `Z`=2051 |
| M | month 1–12 | `1`–`9`, `A`=Oct, `B`=Nov, `C`=Dec |
| D | day 1–31 | `1`–`9`, `A`–`H`, `J`–`K`, `M`–`N`, `P`–`T`, `V`–`Z` (Crockford, skips I L O U) |

Example — 2026-05-29: **`65X-slug.md`**

### Properties

- **3 chars** — same length as the old `NNN`, encodes a full date
- **Zero coordination** — derive from current date; no "find next number" step
- **32 years of coverage** — Y exhausts in 2051; M and D cover all valid calendar values
- **Sortable** — Crockford base32 is ordered, so lexicographic sort = chronological sort
- **Clean transition** — existing `NNN` files (digits `0`–`2`) sort before `6YMD` files since `2` < `6`
- **Repo coherence** — FunctionalScript already has `cbase32` in the codebase

### Day encoding (D)

| Day | Char | Day | Char | Day | Char | Day | Char |
|-----|------|-----|------|-----|------|-----|------|
| 1   | `1`  | 9   | `9`  | 17  | `H`  | 25  | `S`  |
| 2   | `2`  | 10  | `A`  | 18  | `J`  | 26  | `T`  |
| 3   | `3`  | 11  | `B`  | 19  | `K`  | 27  | `V`  |
| 4   | `4`  | 12  | `C`  | 20  | `M`  | 28  | `W`  |
| 5   | `5`  | 13  | `D`  | 21  | `N`  | 29  | `X`  |
| 6   | `6`  | 14  | `E`  | 22  | `P`  | 30  | `Y`  |
| 7   | `7`  | 15  | `F`  | 23  | `Q`  | 31  | `Z`  |
| 8   | `8`  | 16  | `G`  | 24  | `R`  |     |      |

### References

Cross-references use prefix + slug: `[i65X-sandbox](./65X-sandbox.md)`.
The prefix alone is not unique within a day; the slug disambiguates.

## Related

- [i65X](./65X-issue-numbering-format.md) — this issue will self-referentially demonstrate the format once adopted
