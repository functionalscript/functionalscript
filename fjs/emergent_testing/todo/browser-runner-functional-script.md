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
| the interpreter (`import`, `report`, the macrotask yield) | ~55 |
| logic wearing one thin host touch (`runBrowserProofs`'s tail) | ~25 |
| pure already (`text`, `errorDetails`, `moduleFailure`, `reportOf`, the walks) | **moved** |

**The debt row is nearly gone.** `runOne` went with the shared traversal
(functionalscript#1796), `reportOf` and the orchestration followed, and the
loading walk is now `loadProofs`. What is left of `runBrowserProofs` is its
tail: build the interpreter, hold the collected rows, fold the report, and the
deferral that keeps user code from running before the caller holds the promise.

The row that grew is the *interpreter*, and that is the shape the file should
have: `import` resolves a source against the document, `report` renders and
counts, and the macrotask yield gives the page a chance to paint. None of that
is logic — each is one host capability, spelled the way this host spells it.
It grew by less than it might have: the loading walk kept its concurrency
through an `all` handler for one PR, and loading is a sequential fold now, so
the page implements no fan-out and schedules nothing but that one yield.

The question that moved each of them was the same, and it is worth keeping:
not *"does this touch a host object"* but *"which values does it need from
one"*. `reportOf` needed two, so they are passed in. The loading walk needed a
module loader, so that became an operation — and naming it is what turned an
injected `importer` parameter into an interpreter's handler. It appeared to
need a fan-out too; it needed sequencing, which an effect already is.

The pure row has **left**: `text`, `errorDetails`, `moduleFailure` (in
functionalscript#1802, once the `catch` operation existed to carry the first
two) and now `reportOf` are in `../browser/module.f.mjs`, along with
the orchestration the sharing plan moved. That is what took the file from 405
lines to 330.

**The proof file is the visible cost.** [`browser/proof.mjs`](../browser/proof.mjs)
is 628 lines — the largest impure proof file in the repository, and **nearly
half** of all the impure proof code there is (1,376 lines across five files —
one fewer since `website/browser-source.proof.mjs` became FunctionalScript; the
next largest is `rtti/host.proof.mjs` at 379, which exists to build values
FunctionalScript cannot express). It exists to test that logic from Node through
a DOM stand-in. Logic in `.f.mjs`
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
  can throw. That is what the `catch` operation — documented under `Catch` in
  [`fjs/effects/common/types.ts`](../../effects/common/types.ts) — is for, and
  with it they are
  `../browser/module.f.mjs`'s `text` and `errorDetails`, written as effects over
  `catch` rather than as thunks in a `try`. The general shape is worth keeping in
  mind for whatever moves next: pure logic that reads a *user* value is not
  impure, it is effectful.
- **What should remain.** When the extraction is done, `browser/module.mjs`
  should hold
  the DOM adapter, the published promise and completion event, the loading
  importer, and the interpreter for the browser's operations. That is a plausible
  50–80 lines, against 298 today — the 405 this said when it was written came
  down as the orchestration left for `browser/module.f.mjs`. The remaining gap is
  the middle row above, not a rounding error: the DOM adapter is about 85 of
  those 298 lines, and `runBrowserProofs` and `startBrowserTestSources` are the
  rest.

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
- `Catch` in [`fjs/effects/common/types.ts`](../../effects/common/types.ts) —
  the `catch` operation `errorDetails` needed before it could be
  FunctionalScript.
- The same debt in `fjs/website` was **paid** in functionalscript#1824, and what
  it cost is the useful comparison: nothing. `browser-source.mjs` moved to
  `.f.mjs` as a rename, because the rule about immutable *values* says nothing
  about a local counter — a scanner written with `let` and `while` over
  primitives was already FunctionalScript, as `types/list` and `types/bigint`
  are. That is the cheap end of this class of migration, and this file is not
  at it: the debt here is a *host* boundary, and no rename moves one.
