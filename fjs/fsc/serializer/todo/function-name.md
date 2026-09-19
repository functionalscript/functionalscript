## A hoisted function loses its name

**Priority:** P1
**Status:** open — the correction is decided in the compatibility epic, not here

### Problem

JavaScript names a function once, at creation, from the binding or key it
is created for: `const f = () => 1` gives `f.name === 'f'`, `export const g`
gives `'g'`, `{ f: () => 1 }.f` gives `'f'` and `export default () => 1`
gives `'default'`. The linked graph this writer reads carries no name — the
node is `['=>', frame, body]` — so the only names the output has are the
ones the writer invents, and a function it hoists takes one of those.
Observed at `186af0b`:

```js
const f = (...a) => a; export default [f, f];
// written: const $0=(...$a)=>$a;export default [$0,$0];   — name "$0"
export const g = (...a) => a;
// written: const $3=(...$a)=>$a;export const g=$3;          — name "$3"
```

A JavaScript module importing the output reads `$0` and `$3` where the
source reads `f` and `g`. A function written in place is unaffected, since
its key or `default` names it again. No FJS program observes `name`:
`f.name` is refused at the key of `.`, and the language's
[function rules](../../../../spec/README.md#functions) say the name is
erased for that reason. The
[compatibility epic](../../../../todo/fjs-javascript-compatibility.md#function-name--current-implementation-rule-2)
holds it to the generated-JS execution its corpus compares, and classes the
difference as a rule 2 violation there.

### Proposal

The epic names the two root-cause corrections and owns the choice. What is
this writer's under either:

- **The graph carries the name.** The lowering in `fjs/fsc/edag` records
  the name JavaScript would give — the `const`'s, the export's, the key's,
  `default`, or `''` — on the function node, and this writer binds a
  hoisted function under it: `const f=(...$a)=>$a;export default [f,f];`.
  A source name can collide with a generated `$n` or another hoist, and
  `hoistName` already promises no shadowing between scopes, so the name is
  chosen where hoisted names are chosen, with the collision resolved there
  and proved.
- **Name erasure is an exception.** Nothing changes in the writer; the
  proof pins the `$n` name as the recorded consequence, so a later change
  is deliberate.

Either way the proof exercises the exported function from a JavaScript
importer — `name` read on both spellings, in place and hoisted — rather
than comparing the written text.

### Related

- [Compatibility epic](../../../../todo/fjs-javascript-compatibility.md) —
  owns the decision.
- [Function-source representation exception](../../../../spec/README.md#function-source-representation-exception)
  — covers the text, not the name.
