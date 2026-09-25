# Accept disjoint named exports in JSON output

**Priority:** P2
**Status:** open

## Problem

The sharing sweep in [`ast`](../ast/module.f.mjs) conservatively groups
container imports by module identity. It cannot prove that two selected export
roots from the same module have no common descendants. This can reject a JSON
tree as a shared graph.

Reproduction from [PR #2248's review](https://github.com/functionalscript/functionalscript/pull/2248#discussion_r4098489345):

```js
// main
import {a,b} from "./dep";
export default [a,b];
```

```js
// dep
export const a = [1];
export const b = [2];
```

At `624d2cf49b0442d3d726c84c52adb3622c40eae5`, `fjs compile main output.json`
exits with code 1, reports `no JSON spelling for a shared node`, and writes no
output. The value is the JSON tree `[[1],[2]]`. The same input compiles
successfully to `.data.js`, `.f.js` and `.rs`.

This is an explicit false refusal in JSON output. Named-import parsing and
linking succeed. It is deferred under the
[review policy](../../../doc/REVIEW.md#deferring-a-defect); accepting this input
must not weaken the rejection of actual sharing.

## Design constraint

`containerNode` groups imported containers by module ID and records paths
relative to each selected value. `withinPrevious` therefore conflates equal
relative paths under different exports. The additional `overlapping` guard
also treats different selected roots from one module as potentially shared.
Removing only that guard does not establish that the roots are disjoint.

Nor is giving each export its own group sufficient: with
`const shared=[1]; export const a={x:shared}; export const b={y:shared};`,
an importer returning `[a.x,b.y]` reaches the same array twice. Its JSON
output must remain refused. Aliases can select the same root, and distinct
roots can share descendants through local constants or imported modules.

## Tasks

- [ ] Carry enough selected-root and descendant provenance to distinguish
      disjoint roots without losing module identity, cached selections or
      sharing through aliases and diamond imports.
- [ ] Prove the disjoint example emits `[[1],[2]]` as JSON, including default
      and named selections from the same module.
- [ ] Preserve refusal of repeated roots, shared descendants and ancestor/
      descendant selections; retain DataJS graph sharing and the existing
      EDAG/Rust behavior.

## Related

- [one-module-resolution-walk](./one-module-resolution-walk.md) — retains the
  complete module and its per-export binding table during resolution.
- [compile-modules-to-edag](./compile-modules-to-edag.md) — documents the
  existing conservative treatment of sharing across module boundaries.
