# Sharing

Which nodes an EDAG reaches from more than one place. Sharing is the EDAG's
own word: one node object referenced from several places, as a `const` read
twice lowers to. So it is a question of identity, never of spelling: two nodes
spelled alike are two nodes. [`module.f.mjs`](./module.f.mjs) holds the walk.

|Export                       |Answers                                                         |
|-----------------------------|----------------------------------------------------------------|
|`sharedNodesOf`              |the nodes reached by more than one edge                         |
|`visit`, `operandsOf`, `eagerOperandsOf`|the walk and the operands it follows                 |
|`lazy`, `chainLazy`, `isChain`, `members`, `one`|which operands are evaluated only when selected|

[`analysis`](../analysis/README.md)'s `identityAnalysis` reads its counts per
scope, and the conversion to the Foundation AST then chooses one binding for
every shared node, for every output language at once. The serializers write
what they are given and place nothing themselves.
