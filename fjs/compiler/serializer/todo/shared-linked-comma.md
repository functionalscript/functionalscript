## A module read twice whose export is a comma

**Priority:** P3
**Status:** open

### Problem

Linking gives a module that anchors a `const` one comma node — the anchors,
then the export — and gives every import of it that one node
(`fjs/compiler/edag`'s `_defaultExport`). A module that reads such an import
twice shares the comma, and the multi-export writer (`moduleOperand` in
[`../module.f.mjs`](../module.f.mjs)) writes the comma's anchors as the
module's own statements and the comma as an alias of its last operand. At
`7de6ddd5`, over

```js
// m.f.js
const z = [0]; export default 5;
// input.f.js
import m from "./m.f.js"; export default [m, m];
```

the `.f.js` output is

```js
const $0=[0];const $1=5;const $2=[$1,$1];export default $2;
```

which reads back as another graph: the anchor is the module's own comma
around the export, where the original graph has a comma inside the array,
reached from both items. The value is the same; the graph, which the
writer's round trip promises, is not. The compact writer (`_trySerialize`)
refuses the shared comma, `a comma outside a scope`, and `_tryModuleSerialize`
falls back to the multi-export writer, which answers. It predates writing a
shared node once, which writes it the same way.

### Proposal

Refuse it in `moduleOperand`, as the compact writer does, or spell it: a
comma the module shares is one value whose anchors run once, which a block
applied once — `const $2=(()=>{const $0=[0];return 5;})();` — reads back
as. Whichever, the round trip states which.

### Tasks

- [ ] Decide between refusing and spelling the shared comma.
- [ ] Prove the case through `fjsRoundTrip` over two files, or its refusal.

### Related

- [`../module.f.mjs`](../module.f.mjs) — `moduleOperand`,
  `_tryModuleSerialize`.
- [`../../edag/module.f.mjs`](../../edag/module.f.mjs) — `_defaultExport`,
  the linked comma.
