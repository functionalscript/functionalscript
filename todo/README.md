# Issues

## Local todo directories (preferred)

Issues live **next to the code they describe**, as one file per issue in a
`todo/` directory co-located with the relevant module:

- `fjs/djs/todo/{slug-kebab}.md` — todos specific to the `fjs/djs/` module
- `fjs/ci/todo/{slug-kebab}.md` — CI tooling todos
- `nanvm-lib/todo/{slug-kebab}.md` — NaN-VM (Rust) todos
- … and so on.

A `todo/` directory at a higher level (`fjs/todo/`) describes bigger-picture
concerns: architecture decisions, directory restructuring, design philosophy,
cross-cutting changes affecting many submodules. It does **not** duplicate
concrete bugs or tasks that belong in a child `todo/`.

**Rule:** a bug or task scoped to `fjs/foo/bar/` goes in
`fjs/foo/bar/todo/{slug-kebab}.md`, not in a parent directory and not here.

## This directory

`todo/` still holds:

- Issues that span multiple unrelated modules and have no obvious home
- Language-design questions that are not tied to a specific module
- External proposals and investigations

If you can't decide where an issue belongs, leave it here and discuss.

## Blocked by third parties

Issues that cannot progress until an external event occurs (a TC39 proposal lands, a
runtime ships a feature, a dependency releases a fix) live in `todo/blocked/`.

Each file in `todo/blocked/` **must** include a **Trigger** section that states the
precise external condition that unblocks it — a proposal reaching Stage 4, a specific
crate version shipping, etc. Without a clear trigger the issue is just a wish; write the
trigger first or file it as a regular issue instead.

## Issue format

Keep the same structure within `todo/{slug-kebab}.md` files.

Issue headings should be short and direct — describe the action or the thing,
not the full context. Prefer `# Read large files` over
`# The problem with reading big files caused by bit vector limitation`.
A short heading is easier to scan, link to, and reference from other files.

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

Done issues: delete the file immediately in the same PR that fixes the issue.
Before deleting, ensure design decisions are captured in the relevant
`README.md` or JSDoc.

Won't-fix issues: document the reason in the relevant `README.md`, in a code
comment, or in another issue — then delete the issue file.

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

See [spec/README.md](../spec/README.md).
