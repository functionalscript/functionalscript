## Move the browser runner's business logic to FunctionalScript

**Priority:** P2
**Status:** open

### Problem

This is migration debt under the rule that business logic belongs in `.f.mjs`,
not a new proposal.

[`browser/module.mjs`](../browser/module.mjs) is a plain `.mjs` file holding a whole test
runner. Under the repository rule that business logic belongs in `.f.mjs` and
plain `.mjs` is a thin host boundary, most of it is in the wrong place.

Measured by whether a definition touches a host object at all:

| | lines |
| --- | --- |
| genuine DOM/window glue (`setState`, `render*`, `publish`, `viewOf`) | ~50 |
| logic wearing one thin host touch (`runOne`, `runBrowserProofs`, `reportOf`, `startBrowserTestSources`) | ~200 |
| pure already (`text`, `errorDetails`, `moduleFailure`) | ~30 |

The middle row is the debt. `runOne` walks a proof tree, builds results and
recurses — business logic — and is "impure" only because it reads
`performance.now()` and awaits. `reportOf` computes totals and reads
`navigator.userAgent`. `startBrowserTestSources` sequences loading and calls
`import()`. In each case a few host touches keep two hundred lines of logic out
of FunctionalScript.

**The proof file is the visible cost.** [`browser/proof.mjs`](../browser/proof.mjs)
is 493 lines — three times the next impure proof file in the repository — and it
exists to test that logic from Node through a DOM stand-in. Logic in `.f.mjs`
would be proven by an ordinary co-located `proof.f.mjs`; only the DOM adapter
would still need an impure proof. Thin glue needs few `.mjs` proofs, and the
size of this one is a measurement of how thick the glue has become.

### This is mostly already planned

[Share the browser and console proof runners](share-browser-console-runner.md)
steps 4–7 are this extraction, arrived at from the sharing side rather than the
purity side:

- **step 4** moves the host-independent operations to a shared module;
- **step 5** gives the browser an interpreter — where its host touches belong;
- **step 6** shares reporting;
- **step 7** deletes `runOne` outright, because the shared traversal in
  `../module.f.mjs` already does what it does.

So this file is not a competing plan. It is the migration-debt record the rule
asks for, and it names two things the sharing plan does not:

- **`errorDetails` and `text` cannot move as they stand.** Both are pure in
  substance and both need `try`/`catch`, which FunctionalScript does not have —
  reading `message`, `stack` or calling `String` on a hostile value can throw.
  Moving them needs the `catch` operation designed in
  [hostile proof values](hostile-proof-values.md). Until then they are pure logic
  that legitimately cannot be `.f.mjs`, which is worth stating so it is not read
  as laziness.
- **What should remain.** When the extraction is done, `browser/module.mjs`
  should hold
  the DOM adapter, the published promise and completion event, the loading
  importer, and the interpreter for the browser's operations. That is a plausible
  50–80 lines, against 405 today.

### Tasks

- [ ] Extract the proof-tree walk, result building and totals into `.f.mjs`
      (steps 4–7 above), and shrink `browser/proof.mjs` to the DOM adapter's own
      proofs as the logic moves.
- [ ] Record what cannot move and why — starting with the `try`/`catch` in
      `errorDetails`.
- [ ] Check the remaining `.mjs` against the same measure once done: a host
      touch per definition, not a definition per file.

### Related

- [Share the browser and console proof runners](share-browser-console-runner.md)
  — steps 4–7 are this work.
- [Hostile thrown values](hostile-proof-values.md) — the `catch` operation
  `errorDetails` needs before it can be FunctionalScript.
- [Move browser source analysis to FunctionalScript](../../website/todo/browser-source-functional-script.md)
  — the same debt in `fjs/website`.
