## Extract business logic from browser.mjs

**Priority:** P1
**Status:** open

### Problem

[`browser.mjs`](../browser.mjs) is necessarily a plain JavaScript browser host
boundary, but it also contains substantial host-independent proof execution,
result, and traversal logic. Under the repository rule that business logic
belongs in `.f.mjs`, that mixed implementation is migration debt and should be
reduced as soon as possible.

The broader runner-sharing design is already tracked in
[`share-browser-console-runner.md`](share-browser-console-runner.md). That issue
includes architectural work and decisions that need not block extracting
business logic that is already clearly host-independent.

### Proposal

Shrink `browser.mjs` toward a thin browser adapter. Move any business logic that
can be expressed without browser APIs into `.f.mjs`, reusing shared
`emergent_testing/module.f.mjs` logic where appropriate rather than copying it.
Leave only code that genuinely requires browser/host JavaScript behavior in
plain `.mjs`.

Do not use this TODO to redesign proof semantics. If an extraction reaches an
open semantic decision documented by `share-browser-console-runner.md` or one
of its dependencies, leave that specific part for the existing issue and
continue with the unblocked extraction.

### Tasks

- [ ] Identify host-independent logic still implemented in `browser.mjs`.
- [ ] Move each unblocked piece to `.f.mjs` with FunctionalScript proof coverage.
- [ ] Reuse shared emergent-testing logic instead of preserving duplicate browser copies.
- [ ] Keep browser APIs, DOM integration, module loading, and other genuinely host-specific code in the thin `.mjs` boundary.
- [ ] Delete this TODO once `browser.mjs` contains no business logic; the broader runner-sharing TODO may remain open for its other goals.

### Related

- [`browser.mjs`](../browser.mjs)
- [`share-browser-console-runner.md`](share-browser-console-runner.md) — broader runner-sharing design and blocked semantic decisions.
