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

## GitHub issues are an intake channel

GitHub issues are an **intake** channel, not a tracker: external contributors
cannot add `todo/` files, so they report there instead (see
[CONTRIBUTING.md](../CONTRIBUTING.md)). A maintainer creates the `todo/` file for
each such report, linking the GitHub issue from its `Related` section. The
`todo/` file is the tracked issue from then on; the GitHub issue stays open only
as the reporter's thread and is closed when the fix ships.

Reference issues with an explicit link, not GitHub's `#` prefix. `#NNN` is
reserved for GitHub pull request and issue numbers.

## Retired `iNNN` identifiers

Older issues cite each other as `i143`, `i167`, `i65X` and so on — identifiers
from the tracker that preceded these directories, where every module kept a
single `todo.md`. They are **not** GitHub issue numbers: GitHub #167 is an
unrelated 2022 pull request, and the file numbering does not line up either
(`fjs/emergent_testing/todo/028-unit-test-examples-api.md` reports GitHub
issue 403).

A bare `iNNN` with no link means the identifier has no file left to point at:
the issue was closed and deleted, as this README requires, and no successor
document was identified. Three searches are worth running before concluding
that, in rough order of yield:

1. **`git log --grep`.** Commits that close one of these name it — `i167` is
   `d39518d8`, "bit_vec: export msbConcat; drop per-module listToVec(msb)
   re-binds (i167)", and `i160` is `5c1577c6`, "resolve i160 as won't fix".
   This finds work that shipped as *code*, which no filename search can.
2. **The citation's own words.** `i168` is described by its citations as "the
   streaming decoder factory both codecs already share", which is `decoder` in
   `fjs/text/code_point/` almost verbatim.
3. **A zero-padded filename.** `i37` is `037-language-design-map.md`, headed
   `# 37.`; matching the identifier's digits against the filename's exactly
   will miss it.

Where the work is traceable, the citation names what it shipped as instead —
see `i143` and `i172` in `fjs/bnf/todo/207.md`. When you recognize one of the
unlinked identifiers, either give it the same treatment or delete the
reference; do not link it to a same-numbered GitHub issue, which will be the
wrong one.

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
comment, or in another issue — then delete the issue file. Do not leave a
status-only tombstone.

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
