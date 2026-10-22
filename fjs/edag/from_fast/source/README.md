# Source operators in canonical graph producers

`logicalExp(tag, left, right)` lets a producer label a source or native
`&&`, `||` or `??` case while constructing a canonical conditional graph.
It delegates the choice to the shared [source FAST sugar](../../../js/ast/sugar/logical/module.f.js)
and constructs the graph through [`fromFast`](../README.md).

The operands enter once as external binding identities. Their existing graph
objects remain the condition, retained operand or selected right value, so
selection preserves identity and keeps the right operand conditional. The
bridge accepts well-formed graph operands, including invocation fragments;
the consuming boundary retains its ordinary admission responsibilities.

The labels describe source syntax. Canonical graph data contains `?:` and
strict comparisons, with no logical operator tags. The bridge is a producer
convenience rather than an importer for former graph documents.
