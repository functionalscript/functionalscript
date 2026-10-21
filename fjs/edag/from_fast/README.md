# Normalized FAST to EDAG

`fromFast` constructs a graph from immutable value identities, required or lazy
definitions, result blocks and resolved transfers. Source legality, capture
admission and loop-state selection have already finished. A value block adds
no function or invocation boundary.

Functions own targeted returns. A block's normal result can have zero, one or
several values; one stays scalar and the other signatures use an ordered array.
Required definitions retain initializers that the result reaches only
conditionally or does not reach at all. A required root already established
through an eager dependency needs no separate comma operand. This decision uses
FAST binding identities, including for primitive initializers. Lazy definitions
retain required inner evaluations in their own expression and establish them
only when that value is reached. References reuse the established graph node;
equal operations written separately stay separate.

The source consumer is the admitted-source adapter in
[`js/ast/sugar`](../../js/ast/sugar/module.f.mjs). Source admission finishes
before graph construction. Physical prepared FAST is never an input to this API.

The baseline supports the established scalar loop: one parameter and result,
a condition, definitions followed by its continue, and an unchanged-state
break. It constructs the same one-argument recursive helper as the previous
source pipeline. Entry values and captures are established at the original
loop statement, including inside conditional regions. Unused loop results do
not discard the loop's required evaluation.

A canonical scalar invocation loop reuses its enclosing function. Its body
contains only aliases of the current fixed argument before the loop, then a
direct return of the loop's single result. Its arity is one, it reads no rest
array, and the loop enters with that current argument. Reuse keeps the same
frame and self identity. One-time setup, a different invocation layout or
following result processing retains a separate helper.

The direct graph round-trip domain uses canonical binding reads: one node per
argument, frame slot, rest or self binding in each scope, with explicit shared
value definitions and canonical required anchors. Literal undefined nodes use
one fresh occurrence per literal position; arbitrary sharing of the tagged
primitive is outside this exact graph domain. Function captures are
canonical too: every slot is used, nonprimitive and distinct under the existing
binding-read alias rule. Within the supported scalar
root form, reconstruction preserves the direct recursive graph, including its
sharing; it does not add a helper wrapper. Distinct identity-producing
expressions remain distinct. Tests compare identity-analysis tables for this
domain. Graphs with distinct identity-free reads of the same binding normalize
those reads to the common binding node. Primitive and equivalent duplicate
captures normalize through the existing capture compaction, yielding a new graph
identity whose repeated conversions stabilize. Unused nonprimitive slots remain
present and eager in explicit normalized functions, including a failing slot;
their layouts are outside the named exact source-roundtrip domain. The source
adapter's filtering of unused AST capture metadata is a separate existing source
contract. Existing source round trips retain
their analysis-normalized comparison, including the documented lazy-region
splits and redundant-anchor normalization.

General structured completions and lazy demand state crossing a generated
helper boundary belong to epic E. Until then, unsupported loop forms and
nonlocal exits in value regions are refused explicitly. A true lazy free
binding is not eagerly captured by the scalar constructor. The
[loop construction proposal](../todo/fast-loop-construction.md) records the
completion and memo-state contracts for that extension.
