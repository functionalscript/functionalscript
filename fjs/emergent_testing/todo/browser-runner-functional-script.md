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
| genuine DOM/window glue (`setState`, `render*`, `publish`, `viewOf`, `startBrowserTests`) | ~85 |
| logic wearing one thin host touch (`runBrowserProofs`, `reportOf`, `startBrowserTestSources`) | ~155 |
| pure already (`text`, `errorDetails`, `moduleFailure`) | ~30, **moved** |

The middle row is the debt, and it is still the majority of the file. `runOne`
was the largest entry and is gone — the shared traversal replaced it in
functionalscript#1796 — but `runBrowserProofs` still owns the interpreter and the
run's wall clock, `reportOf` computes totals and reads `navigator.userAgent`, and
`startBrowserTestSources` sequences loading and calls `import()`. In each case a
few host touches keep a hundred and fifty lines out of FunctionalScript.

The third row **left** in functionalscript#1802, once the `catch` operation
existed to carry it: `text`, `errorDetails` and `moduleFailure` are in
`../browser/module.f.mjs` now, along with the orchestration the sharing plan
moved. That is what took the file from 405 lines to 320.

**The proof file is the visible cost.** [`browser/proof.mjs`](../browser/proof.mjs)
is 524 lines — about seven times the next impure proof file in the repository,
`effects/node/memory/proof.mjs` at 78 — and it
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
  `../module.f.mjs` already does what it does. **Done**, along with steps 4–6.

So this file is not a competing plan. It is the migration-debt record the rule
asks for, and it names two things the sharing plan does not:

- **`errorDetails` and `text` could not move as they stood, and now have.** Both
  are pure in substance and both need `try`/`catch`, which FunctionalScript does
  not have — reading `message`, `stack` or calling `String` on a hostile value
  can throw. That is what the `catch` operation designed in
  [hostile proof values](hostile-proof-values.md) is for, and with it they are
  `../browser/module.f.mjs`'s `text` and `errorDetails`, written as effects over
  `catch` rather than as thunks in a `try`. The general shape is worth keeping in
  mind for whatever moves next: pure logic that reads a *user* value is not
  impure, it is effectful.
- **What should remain.** When the extraction is done, `browser/module.mjs`
  should hold
  the DOM adapter, the published promise and completion event, the loading
  importer, and the interpreter for the browser's operations. That is a plausible
  50–80 lines, against 320 today — the 405 this said when it was written came
  down as the orchestration left for `browser/module.f.mjs`. The remaining gap is
  the middle row above, not a rounding error: the DOM adapter is about 85 of
  those 320 lines, and `runBrowserProofs`, `reportOf` and `startBrowserTestSources`
  are the rest.

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
