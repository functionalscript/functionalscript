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

- **A status that is not a value.** A status line is a value from the table,
  optionally followed by ` — ` and a note, and most annotated lines already
  read that way. Two do not: `spec/todo/2330-property-accessor.md` writes a
  paragraph — "the constant-key read is in the language …" — with no value,
  and `fjs/effects/todo/effect-list-fold.md` separates its note with a period,
  `wip. Unaffected …`.
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
  issues live, so a reader of the folder takes them for issues, and anything
  that lists issues has no header to read from them. (The website reads no
  subfolder of a `todo/` yet, which also hides the real issues in
  `todo/blocked/`.)
- **READMEs.** A `todo/` directory may carry a `README.md` — this one,
  `spec/todo/`, `todo/plan/`, `todo/demo/`, `todo/sergey/` and
  `todo/sergey/disot/` do — and the website lists it as an issue, since it
  takes every `.md` file in a `todo/` to be one.

### Proposal

A `README.md` documents its directory and is never an issue. Every other `.md`
file in a `todo/` directory is an issue with a full header, or it moves out of
`todo/`; files of other kinds — `todo/proof.f.mjs`,
`todo/demo/data/tree.json` — are not issues and keep their place. Decide per
group:

- Feature drafts in `spec/todo/` are issues: give them a priority and a
  status, and fix their heading level.
- Design documents in `spec/todo/` are not open work: move them next to what
  they design (`spec/design/` or similar), re-basing every link to them, or
  give them a header and accept them as issues.
- `todo/blocked/` holds issues and stays.
- `todo/demo/` holds a `README.md` and data, no issues, and stays.
- `todo/plan/` is a plan, not issues: move it, e.g. to `doc/plan/`.
- `todo/sergey/` is its owner's personal notes
  ([its README](./sergey/README.md)), not issues: move it, e.g. to
  `doc/sergey/`, which keeps it in the repository as the README asks —
  with its owner's agreement, since it is his directory.

Then every subfolder of a `todo/` holds issues, a `README.md` or files that
are not Markdown, and nothing that lists issues needs an exception.

### Tasks

- [x] Replace the paragraph in `2330-property-accessor`'s status with a value
      from the table, keeping the paragraph as body text.
- [x] Change `effect-list-fold`'s `wip.` to `wip —`.
- [x] Add priority and status to the `spec/todo/` feature drafts without them,
      the priority taken from where `spec/todo/README.md` lists each.
- [x] Change `# Title` to `## Title` wherever an issue opens with it.
- [ ] Add a title to the files that have none, or move them out with their
      group.
- [ ] Move the `spec/todo/` design documents to `spec/design/`, with their
      table from `spec/todo/README.md`.
- [ ] Move `todo/plan/` to `doc/plan/`, re-basing links.
- [ ] Move `todo/sergey/` to `doc/sergey/`, re-basing links, in a pull request
      its owner reviews.
- [ ] State in [README.md](./README.md#issue-format) that every `.md` file in
      a `todo/` directory but `README.md` carries the header, and that each
      header field is a value, optionally followed by ` — ` and a note.

### Related

- [issue-status-and-priority](../fjs/website/todo/issue-status-and-priority.md)
  — the website feature that needs this first.
