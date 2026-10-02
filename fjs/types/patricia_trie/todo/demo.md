## A demo that shows content-addressed sharing

**Priority:** P3
**Status:** wip

### Problem

A Patricia trie names each branch by the hash of its two children, so two
tries built from key sets that differ in one key have most of their nodes in
common — with no pointer reused, only equal content. Nothing on the module's
page shows that, and it is the reason the trie is content-addressed.

### Proposal

A website demo in the B-tree demo's shape: a key field with Insert and
Remove, presets, and the trie before and after a step drawn as one graph, so
a subtree both tries share is drawn once and reached from both roots. A
branch is titled with the start of its hash; a leaf shows its key in binary,
which is what the trie branches on.

### Still to do

- Proofs, to 100% coverage of `demo.f.mjs`.
- Extract what this demo and `fjs/types/btree/demo.f.mjs` both do — key
  parsing, presets, the step line, the view, the root arrows and colours —
  into a module both import, rather than a copy.
- Choose the layout: a node one column right of its parent (the prototype),
  or every leaf in the last column, as the B-tree demo has; the trie is not
  balanced, so the second stretches shallow leaves across the page.
