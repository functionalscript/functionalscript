## Impure `.mjs` proofs are Node-only, and that is the answer

**Priority:** P5
**Status:** not planned — recorded so it is not rediscovered as a gap

### The decision

**The browser runs authored FunctionalScript and nothing else.**
`website/browser-prepare.mjs` selects on `name.endsWith('.f.mjs')`, the generated
manifest carries 137 such modules, and impure `.mjs` proofs are excluded by
construction. That is correct behaviour, not a limitation.

Loading JavaScript written against Node into a browser and expecting it to test
anything is a nightmare, and nobody has asked for it. A Node proof reaches for
`node:fs`, `node:vm`, `process`, `node:test`, a filesystem and a subprocess — a
page has none of them, and no convention for labelling tests changes that. The
promise question that led here is the smallest visible corner of it.

**So there is no work item here.** This file exists because the reasoning is
worth keeping: the `.f.mjs`-only rule looks like an omission if you meet it
without context, and someone will otherwise decide it needs fixing.

### Why `.f.mjs` needs no convention

Authored FunctionalScript is pure — no host objects, no `node:` imports, no
promises — so a `.f.mjs` proof means the same thing in `fjs t`, in a browser,
and in any runner added later. The extension *is* the declaration. That is what
lets the browser select statically, without importing anything, and be right.

### If it ever comes up

Only if someone has a concrete impure test they want a browser to run, and can
say why it cannot be written as `.f.mjs`. Two things a design would then have to
face, both easy to miss:

- **Targeting and describing are different questions.**
  `emergent_testing/browser/proof.mjs` and `species.proof.mjs` *test* browser
  code but *run* in Node, against the browser runner called as a library with a
  DOM stand-in. A filename convention that conflates the two would mislabel
  exactly those files.
- **A declaration is a claim, and claims need checking.** A test declaring
  `browser` while importing `node:fs` is a lie the preparation program has to
  catch — the dependency-graph acceptance
  [browser testing](browser-testing.md) already specifies.

### Related

- [Run FunctionalScript proofs inside real browsers](browser-testing.md) — the
  `.f.mjs` selection rule this records the reasoning for.
- [Imports, promises and realms](imports-promises-realms.md) — why that rule
  makes the browser's promise machinery unnecessary.
