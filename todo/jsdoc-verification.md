## jsdoc-verification. Investigate how JSDoc correctness could be checked

**Priority:** P4
**Status:** open

### Problem

Several JSDoc rules are documented and none are checkable. `fjs/AGENTS.md` §2
states where `@module` goes, how `@import` tags are grouped, and what a leading
block must contain; the root `AGENTS.md` prohibits file-scope `@typedef` in
authored `.mjs`. `tsc` sees none of it — a tag in the wrong place, missing, or
absent from a file that needs one all type-check clean.

The consequences are not hypothetical. `@module` drifted onto 102 files against
the documented rule, was stripped from all of them on a misreading of *why* the
rule existed, and the misreading survived a merge because nothing could tell the
difference — then a fourth pass put the tag back on 106 files. Four passes over
one tag, and no check registered any of them; each was caught, if at all, by a
person reading prose.

The obvious repair is not available. Root [`AGENTS.md`
§6](../AGENTS.md#6-external-tools) rules out approximating this with a text
pattern, and for a good reason discovered the hard way: a `grep` for `@module`
cannot distinguish a JSDoc tag from the same characters in a string or a
comment, and the guard built that way flagged the file whose assertions named
it. A checker has to parse.

### Proposal

An investigation, not a design. What to establish:

- **What already parses this.** `deno doc --json` yields `module_doc` and
  per-symbol `jsDoc` — enough to answer "does this file publish module
  documentation", which is most of the `@module` rule, with no new dependency
  and a tool the repository already pins. Whether it can see tag *placement*
  and `@import` grouping is the open question.
- **ESLint**, named in §6 as the kind of tool this wants. `eslint-plugin-jsdoc`
  covers tag presence and shape; whether it can express repository-specific
  rules (this tag in this file kind) without custom rules of our own is what to
  find out. Adding it needs approval per §6, and
  [`../todo/eslint.md`](./eslint.md) already holds that discussion — check it
  before opening a second one.
- **The TypeScript compiler API**, which already parses every file `tsc` reads
  and exposes JSDoc nodes. No new tool to approve, but it means writing a
  checker, which is the cost §6 warns about.

Then decide, per rule, whether it is worth checking at all. §6's position is
that an unenforced written rule beats machinery whose failures are silent, so
"none of these are good enough, leave the rules to review" is a legitimate
outcome of this investigation and should be recorded as one rather than left
open.

**P4 because reviewers do catch these.** Both `@module` reversals were found by
review — one by a human, one by a bot — before either reached a release. This
is worth doing when a tool makes it cheap, not worth building a tool for.

### Tasks

- [ ] Establish what `deno doc --json` can and cannot answer about tag
      placement.
- [ ] Read [`eslint.md`](./eslint.md) and fold this in rather than duplicating
      it, if the answer is ESLint.
- [ ] Pick one rule as the trial — `@module` presence is the narrowest — and
      say what checking it would cost.
- [ ] Decide, and record "not worth it" as an answer if that is the answer.

### Related

- [`../AGENTS.md`](../AGENTS.md#6-external-tools) §6 — why not a text pattern,
  and that a real tool needs approval first.
- [`../fjs/AGENTS.md`](../fjs/AGENTS.md) §2 — the `@module` and `@import` rules
  this would check. The restore that brought the tree into line with §2 is the
  fourth pass over this one tag; no check registered any of the four.
- [`eslint.md`](./eslint.md) — the standing ESLint discussion.
