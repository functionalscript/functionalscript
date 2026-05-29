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
- **32 years of coverage** — Y exhausts in 2051; M and D cover all valid calendar values.
  After 2051 we switch to emoji 🎃. *(Half a joke — IPFS CIDs already support
  `base256emoji` encoding, so the industry has already been there:
  [CID conversion](https://docs.ipfs.tech/concepts/content-addressing/#cid-conversion).)*
- **Sortable** — Crockford base32 is ordered, so lexicographic sort = chronological sort
- **Clean transition** — existing `NNN` files (digits `0`–`2`) sort before `6YMD` files since `2` < `6`
- **Repo coherence** — FunctionalScript already has `cbase32` in the codebase

### Day encoding (D)

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

### References

Cross-references use prefix + slug: `[i65X-sandbox](./65X-sandbox.md)`.
The prefix alone is not unique within a day; the slug disambiguates.

## Related

- [i65X](./65X-issue-numbering-format.md) — this issue will self-referentially demonstrate the format once adopted
