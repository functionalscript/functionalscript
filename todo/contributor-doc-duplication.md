## Contributor docs restate rules

**Priority:** P4
**Status:** open

### Problem

[CONTRIBUTING.md](../CONTRIBUTING.md) describes the contributor documents as a
set where "every document links to the others rather than restating them, so
they cannot drift apart". Several rules are restated nonetheless, each copy
worded a little differently:

- **Where `tsc` comes from, and why not `npx tsc`.** Explained in
  [AGENTS.md](../AGENTS.md), CONTRIBUTING.md's
  [Requirements](../CONTRIBUTING.md#requirements),
  [fjs/AGENTS.md §1.1](../fjs/AGENTS.md#11-commands),
  [`fjs/ci/README.md`](../fjs/ci/README.md) under "Expected package scripts",
  and the module comment of
  [`fjs/ci/dev/module.f.mjs`](../fjs/ci/dev/module.f.mjs).
- **No file-scope `@typedef` in authored `.mjs`; named types in `types.ts` or
  `private.ts`.** Stated in AGENTS.md §3,
  [fjs/AGENTS.md §3.2](../fjs/AGENTS.md#32-types), and again in
  CONTRIBUTING.md's [Running tests](../CONTRIBUTING.md#running-tests), a
  section about running tests.
- **The pre-submit check set.** AGENTS.md owns which checks a change runs;
  CONTRIBUTING.md and [nanvm/lib/AGENTS.md](../nanvm/lib/AGENTS.md) restate
  the commands and link to it for the rule.

AGENTS.md describes itself as a map that "holds the facts you must not violate
and links to the document that holds the rest", so some restatement there is
by design. Where that ends, and which document owns each rule, is not written
down anywhere, which is how the check set came to differ between copies.

### Tasks

- [ ] Decide which document owns each restated rule, and what AGENTS.md keeps
      as a one-line summary
- [ ] Replace the other copies with links, or change CONTRIBUTING.md's claim
      that the documents do not restate each other

### Related

- [contributor-docs-stale-references](./contributor-docs-stale-references.md)
  — stale references in the same documents
