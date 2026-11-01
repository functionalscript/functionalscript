# Immutable single-result statement joins

`_immutableJoin(function)` runs on normalized FAST before common preparation
chooses physical result slots. One statement conditional with one result and
its following returned computation become a private continuation parameterized
by that result. Required prefix work stays before the decision; required suffix
work stays in the continuation and runs only on a normally completing arm.
Existing owning returns and throws bypass the continuation.
The pass trusts normalized transfer ownership and normal result arities;
producer invariants are not revalidated as a separate admission boundary.
False-arm declarations moved after the returning guard must retain fresh
binding identities at the function root. A declaration that shadows a
parameter, capture, rest binding or required prefix keeps the original branch
scope and physical join plan. Nested declarations that remain in their own
branches do not need to move.

The initial profile accepts required definitions, one top-level result-bearing
conditional, and result-free nested decisions in its arms. Operand value blocks,
value conditionals, lazy definitions, statement blocks, loop transfers and
broader result signatures retain their existing lowering. Ordinary nested
function bodies remain opaque; their capture expressions are checked in the
constructing region. Parameters, rest and established captures retain their
original bindings and lifetimes.

Functions with an explicit self binding retain their existing plan. Moving a
self-tail suffix into a helper could hide the owning self transition, including
a call through a local alias. This profile adds no recursive fallback or new
tail-call eligibility rule.

The transformation uses existing normalized function, capture, conditional,
yield and return constructs. Both target writers consume common preparation;
neither reconstructs joins independently. Unsupported profiles return the input
function unchanged. Graph conversion's one-pass invocation wrappers and general
graph/text canonicalization remain separate boundaries.

The JavaScript renderer omits empty alternatives, so the extracted guards use
the existing FJS spelling. Public source preparation also reuses this pass after
[canonical one-pass recovery](../one_pass/README.md). Source admission still
belongs to the source coordinator; this pass adds no source grammar.
