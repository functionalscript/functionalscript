# Normalized FAST to EDAG

`fromFast` constructs a graph from immutable binding identities, explicit required
evaluations, lazy definitions, value blocks, conditionals and ordinary functions.
Functions own targeted returns. A block's normal result can have zero, one or
several values; one stays scalar and the other signatures use an ordered array.

Required definitions retain initializers that the result reaches only
conditionally or does not reach at all. A required root already established
through an eager dependency needs no separate comma operand. This decision uses
FAST binding identities, including for primitive initializers. Lazy definitions
retain their required inner evaluations in their own expression and establish
them only when that value is reached. References reuse the established graph
node; equal operations written separately stay separate.

The first source consumer is the admitted-source adapter in
[`js/ast/sugar`](../../js/ast/sugar/module.f.mjs). Its existing scalar loops still
arrive as recursive functions during the initial foundation increment. This
preserves the existing source graph contract while the direct structured input
migration proceeds.

Structured loops and nonlocal transfers from value regions are explicitly
refused by this initial constructor. Statement/result blocks and conditional
arms support normal yields and throws; a return at an ordinary function's body
boundary targets that function. General completion propagation is a later loop
construction increment. Physical prepared FAST is never an input to this API.
