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

- **Status as the icon.** Today's issue icon stays for `open`; `wip`,
  `blocked`, `on-hold` and `done` each get their own, drawn by the stylesheet
  from a `data-status` attribute with a text alternative, as `data-kind` is
  drawn today.
- **Priority as a short text badge** after the name — `P1` … `P5` — accented
  for P1 and P2, muted for the rest. The levels are ordered, which a label
  says better than five pictures.
- **Ordered by priority, then status, then name.**

The header is read strictly: a missing or unknown status or priority fails the
build, naming the file
([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)),
rather than showing a guess. The status values live once, in the reader,
and [todo/README.md](../../../todo/README.md#status-values) points at them.

Epics and issue titles are left for later.

### Tasks

- [ ] A FunctionalScript reader from an issue's text to its status and
      priority, or a refusal, with a proof at 100% coverage.
- [ ] Read every issue in the build; `Dir.todo` carries name, status and
      priority.
- [ ] `data-status`, `data-priority`, the badge and the order in
      `page/module.f.mjs`; the four icons in `style/module.f.js`.
- [ ] Update the website proofs and [README.md](../README.md).

### Related

- [issue-headers](../../../todo/issue-headers.md) — makes every header
  readable first.
