## Normalize issue headers

**Priority:** P3
**Status:** open

### Problem

[README.md](./README.md#issue-format) gives every issue one shape: a
`## Title` heading, then `**Priority:**` and `**Status:**` lines whose values
come from its two tables. Many files under `todo/` directories do not follow
it, so nothing can rely on the header — not a reader scanning a directory, and
not [the website](../fjs/website/todo/issue-status-and-priority.md), which
wants to show each issue's status and priority and order the list by them.

What is wrong, at `4f44c5d`:

- **A status that is not a value.** `spec/todo/2330-property-accessor.md`
  writes a paragraph after `**Status:**` — "the constant-key read is in the
  language …" — where the table allows one word.
- **No header.** About a dozen and a half files have neither line. In
  `spec/todo/` they are feature drafts — `2340-operators`, `2360-built-in`,
  `3360-type-annotations`, `3370-type-inference`, `3380-promise`,
  `3390-class`, `3430-assignments` — and the design documents its README
  lists under *Design documents*. The rest are `todo/plan/` and
  `todo/sergey/`.
- **The title at the wrong level.** Nearly every file in `spec/todo/`, and
  `fjs/website/todo/directory-drawer-without-runner.md`, opens with `# Title`
  instead of `## Title`.
- **No title at all.** `todo/sergey/nan-ptr.md`, `todo/sergey/cavm.md` and
  `todo/sergey/disot/doc-def.md` start with their content.
- **Documents that are not issues.** The design documents in `spec/todo/`,
  the plan in `todo/plan/` and the personal notes in `todo/sergey/` live where
  issues live, so anything that lists issues lists them too, and has no
  header to read from them.

### Proposal

Every file in a `todo/` directory is an issue with a full header, or it moves
out of `todo/`. Decide per group:

- Feature drafts in `spec/todo/` are issues: give them a priority and a
  status, and fix their heading level.
- Design documents in `spec/todo/` and `todo/plan/` are not open work: move
  them next to what they design (`spec/design/`, `doc/plan/`, or similar),
  re-basing every link to them, or give them a header and accept them as
  issues.
- `todo/sergey/` is kept by its owner's request
  ([its README](./sergey/README.md)): it stays, as a named exception like
  [the research exception](./README.md#research-exception), and whatever
  lists issues skips it — unless its owner prefers to move it.

### Tasks

- [ ] Replace the paragraph in `2330-property-accessor`'s status with a value
      from the table, keeping the paragraph as body text.
- [ ] Add priority and status to the `spec/todo/` feature drafts without them.
- [ ] Change `# Title` to `## Title` wherever an issue opens with it.
- [ ] Add a title to the files that have none, or move them out with their
      group.
- [ ] Decide and apply the placement of the design documents, `todo/plan/`
      and `todo/sergey/`.
- [ ] State in [README.md](./README.md#issue-format) that every file in a
      `todo/` directory carries the header.

### Related

- [issue-status-and-priority](../fjs/website/todo/issue-status-and-priority.md)
  — the website feature that needs this first.
