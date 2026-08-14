# Split `AGENTS.md` into scoped documents

**Priority:** P3
**Status:** open

## Problem

`AGENTS.md` is ~1300 lines, and every agent session loads all of it regardless
of the task. An agent writing Rust in `nanvm-lib/` pays for ~700 lines of
TypeScript/JSDoc coding style; an agent fixing a changelog entry pays for the
effects-chaining rules. The context cost is real (agents have limited context
windows and attention), and a monolithic file also invites drift: some content
already half-duplicates `CONTRIBUTING.md`, `todo/README.md`, and
`changelog/README.md`.

An agent needs **scoped context**: the root document should carry only the
main principles and a brief per subject — enough to start working — with a
link to the detailed document, which is read only when the task actually
touches that subject.

## Proposal

### Target shape of the root `AGENTS.md`

Follow the pattern already used for issues (`todo/` files co-located with the
code they describe): detailed instructions live next to what they govern, and
the root file becomes a map.

```markdown
# Header

Brief (a few sentences) so an agent can start working even after these
sentences. Most important facts here.

## 1. Specific Subject

Brief about the specific subject and a link to a more detailed document.

...try not to make more than 5 sections.
```

Rules for the split:

- **Briefs are concise but simple explanations. No noise.** Each section is a
  few sentences: the principle, the one fact an agent must not violate even
  without reading further, and the link.
- **One home per fact.** A brief links to the detailed document; it never
  restates it, so the two cannot drift apart (the rule `CONTRIBUTING.md`
  already declares for itself).
- **Scoped documents are `AGENTS.md` files co-located with the code they
  govern** (`fjs/AGENTS.md`, `nanvm-lib/AGENTS.md`). The root brief links to
  each scoped file explicitly, so an agent that reads only the root still
  finds them by following the link — auto-discovery is not load-bearing. It
  is a real optimization where available, though: the nested-`AGENTS.md`
  convention is documented at [agents.md](https://agents.md/) ("the closest
  file takes precedence" in monorepos) and is followed by Codex and Cursor,
  and Claude Code loads nested memory files on demand when working inside a
  subtree. Content that already has a natural home in an existing document
  (`CONTRIBUTING.md`, `todo/README.md`, `changelog/README.md`, module
  `README.md`s) moves there instead of into a new file.
- **At most ~5 sections in the root file**, and the same budget applies to
  each scoped document: if `fjs/AGENTS.md` itself grows past what a brief-plus-
  links structure can hold, split it the same way one level deeper (e.g.
  `fjs/effects/AGENTS.md`) — but only when that pressure is real, not
  preemptively.

### Root `AGENTS.md` outline

Header brief (before any section): monorepo map (`fjs/` =
FunctionalScript/TypeScript, `nanvm-lib/` = Rust), issues live in `todo/`
directories not on GitHub, the check set to run before submitting
(`npx tsc`, `fjs test`, `cargo test`/`clippy`/`fmt` when Rust is touched),
and the two top principles: simplicity over optimization, and the API is the
most important part of quality.

1. **Workflow** — issue in `todo/` first, design before implementation, delete
   the issue file in the fixing PR. Link: `todo/README.md`.
2. **Environment and running tests** — `npm ci` / `cargo fetch`; one canonical
   test command. Link: `CONTRIBUTING.md` (which absorbs the §1 details, e.g.
   the twelve-row test-runner table).
3. **FunctionalScript / TypeScript (`fjs/`)** — proofs with 100% coverage are
   mandatory; immutability; no `try`/`catch`; JSDoc types. Link:
   `fjs/AGENTS.md`.
4. **Rust (`nanvm-lib/`)** — cargo commands; avoid `macro_rules!`. Link:
   `nanvm-lib/AGENTS.md`.
5. **Pull requests and releases** — one feature per PR; changelog entry per
   code PR; breaking changes are welcome when they improve the API. Links:
   `changelog/README.md`, `CONTRIBUTING.md`.

### Destination map for the current sections

| Current `AGENTS.md` section                 | Destination                                                        |
| ------------------------------------------- | ------------------------------------------------------------------ |
| §1 Development environment (incl. §1.4 runner table, §1.5 updates) | `CONTRIBUTING.md` (already covers half of it) |
| §1.6 Rust commands                          | `nanvm-lib/AGENTS.md`                                              |
| §2 Everyday workflow                        | root brief (it is short and is the "most important facts")         |
| §3 Testing and proof coverage               | `fjs/AGENTS.md` (extension contract details stay in `fjs/fsc/README.md`) |
| §4 Documentation (JSDoc/module headers)     | `fjs/AGENTS.md`                                                    |
| §5 Design principles                        | §5.1–5.2 condensed into the root brief; the full text plus §5.3–5.8 into a linked design document (see open question below) |
| §6 Coding style §6.1–6.6                    | `fjs/AGENTS.md`                                                    |
| §6.7 Rust                                   | `nanvm-lib/AGENTS.md`                                              |
| §7 Issues                                   | root brief + the filing table merged into `todo/README.md`         |
| §8 Pull requests, changelog, versioning     | §8.3 entry rules and §8.4 versioning into `changelog/README.md`; §8.1–8.2 stay as the root brief |
| §8.5 Commit messages (in flight in [#1561](https://github.com/functionalscript/functionalscript/pull/1561)) | `CONTRIBUTING.md` — the title-form and squash-merge rules are PR-process, not changelog content. `todo/commit-message-enforcement.md` will lint against wherever it lands, so repoint that issue's links in the same PR. |

### Open questions

- **Where do repo-wide design principles (§5) live in full?** They apply to
  both codebases, so neither `fjs/AGENTS.md` nor `nanvm-lib/AGENTS.md` is
  right. Options: keep them as the one long section of the root file
  (weakens the "brief only" rule), or a dedicated linked document (e.g.
  `doc/design.md` — introduces a new directory). Decide before implementing.
- **Does `nanvm-lib/AGENTS.md` need more than §1.6 + §6.7?** Probably yes
  eventually (error-handling patterns, testing conventions live in
  `nanvm-lib/todo/` issues today), but the split PR should only move existing
  text, not write new guidance.

### Migration rules

- Move text, don't rewrite it — a pure relocation PR is reviewable; combined
  relocation-plus-editing is not. Tightening a moved section is a follow-up.
- Fix all inbound links in the same PR. Exactly four files link to
  `AGENTS.md#` anchors today — `CONTRIBUTING.md` (five anchors),
  `docker/README.md`, `changelog/README.md`, and
  `fjs/bnf/todo/669-bnf-matcher-shared-core.md` — so no redirect stubs are
  needed; update the links to the new homes. Two caveats: the `bnf` issue
  links to a deep `####` anchor inside §6.3 and to §5.2's own heading, and
  the §5.2 one cannot be repointed until the §5 open question is decided; and
  [#1561](https://github.com/functionalscript/functionalscript/pull/1561)
  adds more `AGENTS.md#` links (from `CONTRIBUTING.md` and two
  commit-message `todo/` files), so re-run the inventory
  (`grep -rn 'AGENTS\.md#' --include='*.md'`) when implementation starts.
- No CHANGELOG entry: documentation-only PR.

## Tasks

- [ ] Decide the home for the full §5 design-principles text (open question
      above).
- [ ] Move §1 environment details into `CONTRIBUTING.md`, deduplicating with
      what it already says.
- [ ] Create `fjs/AGENTS.md` from §3, §4, §6.1–6.6.
- [ ] Create `nanvm-lib/AGENTS.md` from §1.6 and §6.7.
- [ ] Merge the §7 filing table into `todo/README.md`; move §8.3–8.4 into
      `changelog/README.md` and §8.5 (once
      [#1561](https://github.com/functionalscript/functionalscript/pull/1561)
      lands) into `CONTRIBUTING.md`.
- [ ] Rewrite the root `AGENTS.md` as the header brief plus ≤5 brief+link
      sections per the outline above.
- [ ] Re-run the inbound-link inventory, then update every file with
      `AGENTS.md#` anchor links (today: `CONTRIBUTING.md`,
      `docker/README.md`, `changelog/README.md`,
      `fjs/bnf/todo/669-bnf-matcher-shared-core.md`).
- [ ] Verify each moved fact exists in exactly one place (grep for duplicated
      sentences between root, scoped files, and `CONTRIBUTING.md`).

## Related

- [todo/README.md](./README.md) — the co-location pattern this split follows.
- [CONTRIBUTING.md](../CONTRIBUTING.md) — declares the "link, don't restate"
  anti-drift rule and absorbs the environment details.
- [changelog/README.md](../changelog/README.md) — absorbs the changelog-entry
  and versioning rules.
