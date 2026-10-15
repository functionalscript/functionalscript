## A linked module whose export is a comma

**Priority:** P3
**Status:** open

### Problem

Linking gives a module that anchors a `const` one comma node — the anchors,
then the export — and gives every import of it that one node
(`fjs/compiler/edag`'s `_defaultExport`). Wherever such an import stands —
read twice, read once, read lazily, or not read and anchored — the
multi-export writer (`moduleOperand` in [`../module.f.mjs`](../module.f.mjs))
writes the comma's anchors as the module's own statements and the comma as
an alias of its last operand. At `7de6ddd5`, over

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
writer's round trip promises, is not. `import m from "./m.f.js"; export
default [m];`, the comma read once, reads back as another graph in the same
way, and so does an unread import of such a module. The compact writer
(`_trySerialize`) refuses the comma, `a comma outside a scope`, and
`_tryModuleSerialize` falls back to the multi-export writer, which answers
where the comma stands among the module's own operands. It predates writing
a shared node once, which writes it the same way.

Where no module operand holds the comma, both writers refuse it. An unread
import is no anchor where another import's node reaches it
(`fjs/compiler/edag`'s `anchoredImports`), so a module importing `m` both
directly, unread, and through a module that reads `m` only inside a
function's captures, `const c = () => m;`, holds `m`'s comma only in that
capture, and its `.f.js` output is refused. `2ca692ba` anchored the unread
import at the root and wrote text that reads back as another graph.

### Proposal

Refuse it in `moduleOperand`, as the compact writer does, or spell it: a
comma the module shares is one value whose anchors run once, which a block
applied once — `const $2=(()=>{const $0=[0];return 5;})();` — reads back
as. Whichever, the round trip states which.

### Tasks

- [ ] Decide between refusing and spelling the linked comma, wherever it
      stands: a module operand, an item, a lazy operand, a capture.
- [ ] Prove the cases through `fjsRoundTrip` over two files, or their
      refusals.

### Related

- [`../module.f.mjs`](../module.f.mjs) — `moduleOperand`,
  `_tryModuleSerialize`.
- [`../../edag/module.f.mjs`](../../edag/module.f.mjs) — `_defaultExport`,
  the linked comma.
