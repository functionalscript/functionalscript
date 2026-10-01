## A demo that shows structural sharing

**Priority:** P3
**Status:** wip

### Problem

Every insert into `btree` builds a new tree and leaves the old one intact, but
only the path from the root to the change is rebuilt: every other subtree is
the same object in both versions. Nothing on the module's page shows that, and
it is the property that makes a persistent tree affordable.

### Proposal

A website demo: type a key, press **Insert** or **Remove**, and see the
previous and the current tree drawn together with the shared `graph` module.
Since that module draws one node per distinct reference, a subtree both
versions hold is drawn once with an edge from each root. Nodes the operation
built are marked new, and a line counts new and shared nodes.

Example: keys 1–7, insert 8 — three new nodes (the root, `[6]`, `[7,8]`) and
four shared, including the whole `[2]` subtree.
