## Show issue status and priority

**Priority:** P3
**Status:** blocked
**Blocked by:** [Normalize issue headers](../../../todo/issue-headers.md)

### Problem

A directory's page lists its issues by file name, alphabetically, all with the
same icon. A reader cannot tell open work from work in progress or blocked
work, nor a P1 from a P5, without opening each one — and the P1s, the issues
that block everything else, sit wherever their names sort.

### Proposal

Read each issue's `**Status:**` and `**Priority:**` lines during the build and
show them:

- **Status as the icon.** Today's issue icon stays for `open`; every other
  value in [the table](../../../todo/README.md#status-values) — `wip`,
  `blocked`, `on-hold`, `done`, `irrelevant` and `won't fix` — gets its own,
  drawn by the stylesheet from a `data-status` attribute with a text
  alternative, as `data-kind` is drawn today.
- **Priority as a short text badge** after the name — `P1` … `P5` — accented
  for P1 and P2, muted for the rest. The levels are ordered, which a label
  says better than five pictures.
- **Ordered by priority, then status, then name.** The status order is
  `wip`, `open`, `blocked`, `on-hold`, `done`, `irrelevant`, `won't fix`:
  work in progress first, then work not started, then work waiting or
  deferred, then the record, then what will not be done.

**What is read.** Only `todo/` files other than `README.md`, which documents
its directory rather than being an issue. A status line is a value, optionally
followed by ` — ` and a note; the note — to the end of the line and any lines
continuing it, up to the next header field or blank line — is not read. So
`open — needs a decision` is `open`, and the documented `done — kept as the
record; cited by …` is `done`.

**Strictly.** A missing or unknown status or priority fails the build, naming
the file, rather than showing a guess
([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
No default icon for an unknown value: the likely unknown value is a typo —
`opne`, `in progress` — which a default would publish looking normal. The
values live once, in the reader, with their icons and order, and
[todo/README.md](../../../todo/README.md#status-values) points at them, so a
new status is one change, made in the pull request that introduces it. That
pull request's Cloudflare preview build is where a missing one shows, before
merge — `gen.ci.yml` does not build the site.

Epics and issue titles are left for later.

### Tasks

- [ ] A FunctionalScript reader from an issue's text to its status and
      priority, or a refusal, with a proof at 100% coverage.
- [ ] Read every issue in the build; `Dir.todo` carries name, status and
      priority.
- [ ] Stop listing `README.md` as an issue (`isIssue` in `module.f.mjs`).
- [ ] `data-status`, `data-priority`, the badge and the order in
      `page/module.f.mjs`; the six new icons in `style/module.f.js`.
- [ ] Update the website proofs and [README.md](../README.md).

### Related

- [issue-headers](../../../todo/issue-headers.md) — makes every header
  readable first.
