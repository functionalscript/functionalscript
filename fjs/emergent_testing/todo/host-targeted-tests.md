## A convention for saying which host a non-FunctionalScript test targets

**Priority:** P5
**Status:** open — no demand for it yet; filed so the constraint is written down

### Problem

Authored FunctionalScript runs anywhere. `.f.mjs` is pure — no host objects, no
`node:` imports, no promises — so a `.f.mjs` proof means the same thing in
`fjs t`, in a browser, and in any runner added later. That is why the browser
suite can select on the extension alone (`website/browser-prepare.mjs`:
`name => name.endsWith('.f.mjs')`) and be right.

Impure `.mjs` proofs have no such property, and there is no way to say what they
need. Today there are five, and they differ:

| proof | what it needs |
| --- | --- |
| `effects/node/memory/proof.mjs` | Node |
| `rtti/host.proof.mjs` | Node |
| `website/browser-source.proof.mjs` | Node |
| `emergent_testing/browser/proof.mjs` | Node, though it *tests* browser code |
| `emergent_testing/browser/species.proof.mjs` | Node, likewise |

The last two are the interesting ones: they exercise the browser runner by
calling it as a library from Node with a DOM stand-in. So "which host does this
test target" and "which host does this test *describe*" are different questions,
and a convention has to answer the first without being confused by the second.

The current rule — impure proofs are Node-only, by construction — is correct and
costs nothing, because nobody has wanted otherwise. **This issue is not a
proposal to change that.** It exists so that the day someone does want a
browser-only impure test, the constraint is already written down rather than
rediscovered.

### Why it is P5

Nothing is blocked. The browser suite runs 137 `.f.mjs` modules and excludes
impure proofs by construction; that is the desired behaviour, not a limitation
being worked around. Running Node tests in a browser is not a goal — a promise
would be the least of what goes wrong, since a Node proof reaches for `node:fs`,
`node:vm`, `process` and a filesystem that a page does not have.

The cost of *not* doing this is small and known: an impure test that could run in
a browser does not, and nobody notices, because none exists.

### Preliminary design

Unexplored on purpose. Things a design would have to settle:

- **Where the declaration lives.** A filename convention (`proof.node.mjs`,
  `proof.browser.mjs`) is discoverable without executing anything, which is what
  the browser's static selection needs. An export (`export const hosts = […]`)
  is more expressive and requires importing the module to read it — which the
  preparation program deliberately does not do.
- **What the vocabulary is.** `node` and `browser` are the two that exist. A
  list is probably better than a single value, and "runs anywhere" already has a
  spelling: `.f.mjs`.
- **What a runner does with a test it cannot host.** Skipping silently is the
  behaviour that hides a suite quietly losing coverage — see the proof-count
  floor in [browser testing](browser-testing.md). Reporting it as skipped, with
  a reason, is the honest form.
- **Whether the graph still has to be checked.** A test declaring `browser` and
  importing `node:fs` is a lie the preparation program should catch, which is
  the dependency-graph acceptance
  [browser testing](browser-testing.md) already specifies.

### Related

- [Run FunctionalScript proofs inside real browsers](browser-testing.md) — the
  selection and dependency-graph rules this would extend.
- [Imports, promises and realms](imports-promises-realms.md) — why the
  `.f.mjs`-only rule makes the browser's promise machinery unnecessary, and what
  changes if that rule is ever relaxed.
- [`.f.mjs` proof discovery and coverage](f-mjs-test-and-coverage.md)
