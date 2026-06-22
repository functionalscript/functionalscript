# Issues

## Local todo files (preferred)

Issues live **next to the code they describe**, as `todo.md` files co-located
with the relevant module directory:

- `fs/djs/todo.md` — todos specific to the `fs/djs/` module
- `fs/ci/todo.md` — CI tooling todos
- `nanvm-lib/todo.md` — NaN-VM (Rust) todos
- … and so on.

A `todo.md` at a higher level (`fs/todo.md`) describes bigger-picture
concerns: architecture decisions, directory restructuring, design philosophy,
cross-cutting changes affecting many submodules. It does **not** duplicate
concrete bugs or tasks that belong in a child `todo.md`.

For a larger standalone topic, use a named file `todo-${topic}.md` in the
relevant directory and link to it from `todo.md`.

**Rule:** a bug or task scoped to `fs/foo/bar/` goes in `fs/foo/bar/todo.md`,
not in a parent directory and not here.

## This directory

`issues/` still holds:

- Issues that span multiple unrelated modules and have no obvious home
- Language-design questions that are not tied to a specific module
- External proposals and investigations

If you can't decide where an issue belongs, leave it here and discuss.

## ID prefix encoding

Each issue starts with a four-digit [Crockford base32](https://www.crockford.com/base32.html)
prefix `YMDH` encoding the creation date and hour in **UTC/GMT**:

| Digit | Encodes | Range |
|-------|---------|-------|
| Y | year − 2020 | `0`=2020 … `6`=2026 … `Z`=2051 |
| M | month | `1`–`9`, `A`=Oct, `B`=Nov, `C`=Dec |
| D | day | `1`–`9`, `A`=10 … `Z`=31 (see day table) |
| H | hour (0–23) | `0`–`9`, `A`=10 … `Q`=23 (see hour table) |

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

### Hour encoding

| Hour | Code | | Hour | Code |
|------|------|-|------|------|
| 0  | `0` | | 12 | `C` |
| 1  | `1` | | 13 | `D` |
| 2  | `2` | | 14 | `E` |
| 3  | `3` | | 15 | `F` |
| 4  | `4` | | 16 | `G` |
| 5  | `5` | | 17 | `H` |
| 6  | `6` | | 18 | `J` |
| 7  | `7` | | 19 | `K` |
| 8  | `8` | | 20 | `M` |
| 9  | `9` | | 21 | `N` |
| 10 | `A` | | 22 | `P` |
| 11 | `B` | | 23 | `Q` |

Example: 2026-06-22 at 14:00 UTC → `66PE-kebab-slug`.

## Issue format

Keep the same structure within `todo.md` files. Each issue is a `##` section:

```md
## Title

**Priority:** P1 | P2 | P3 | P4 | P5
**Status:** open | wip | blocked | on-hold | irrelevant | won't fix
**Blocked by:** [other issue title](#other-issue-title)

### Problem

Why this needs to be addressed.

### Proposal

What we plan to do. Omit if no design yet.

### Tasks

- [ ] concrete step 1
- [ ] concrete step 2

### Related

- link — relationship note
```

Done issues: set **Status: done** and remove the section in the next cleanup pass.
Before removing, ensure design decisions are captured in the relevant
`README.md` or JSDoc.

## Priority scale

| Level | Meaning |
|-------|---------|
| P1 | Blocking — nothing else can proceed |
| P2 | High — current sprint |
| P3 | Normal — default |
| P4 | Low — nice to have |
| P5 | Minimal — do only if it falls in our lap |

## Status values

| Value | Meaning |
|-------|---------|
| `open` | Not yet started |
| `wip` | Work in progress |
| `blocked` | Waiting on another issue |
| `on-hold` | Intentionally deferred |
| `irrelevant` | Superseded or obsolete |
| `won't fix` | Deliberately will not be implemented |

## Language Specification

See [lang/README.md](./lang/README.md).
