# EDAG output conversion

The output pipeline is `identityAnalysis` / checked admission → `fromAnalysis`
(normalized FAST) → common FAST preparation → a target serializer. Runtime
value output, code-only function text and Rust output use this same conversion.
Serializers receive prepared instructions and allocate lexical names; they do
not inspect EDAG reachability, choose value owners or reconstruct recursion.
`fromAnalysis` accepts a trusted table, including explicit fragment bindings;
`toFast` is the checked graph boundary.

Graph conversion assumes the canonical `Exp` shapes. `checked` admits invocation
bindings and scopes; it does not replace the EDAG shape schema. In particular,
a plain `.` continuation starts with a terminal `|()` or an optional `|?.()`.
An ordinary path such as `base.x.y(args)` uses nested `.` nodes, so its final
call's arguments are eager operands. A `|.` continuation is legal only inside
an optional region, for example `base?.x.y(args)` or `base.x?.().y(args)`; its
later keys and calls remain inside that region. See the
[chain grammar](../README.md#which-step-is-legal-where). Extending the traversal
to accept `|.` directly after a plain `.` would admit a second graph spelling
which the canonical schema and source parser exclude.

Required definitions remain in the execution region that establishes them.
Captures establish their values before closure construction, including unused
nonprimitive captures. Shared allocations and calls reached only through lazy
regions have one lazy definition in their common region. Preparation gives that
definition invocation-local memo storage, demanded on its first executed read.
A failed initializer does not mark its storage complete. A loop recreates its
iteration-local definitions and capture snapshots each iteration.

A value shared across otherwise separate lazy regions may instead be repeated
when every operation reachable from it is `mergeable` and none is a comma.
This transitive check stops at values already established eagerly or by an
outer binding. Thus an eagerly established array can have its pure length read
repeated in separate branches, while an array allocation, function allocation,
helper function, call or sequence confined to those branches keeps one lazy
owner. This is the existing source writer's pure lazy normalization, now chosen
once for all targets. It can split graph nodes; it preserves evaluation and
allocation identity at the established bindings.

The exact graph round-trip domain uses canonical capture layouts and canonical
binding reads. FAST references use binding object identity, and `fromFast`
constructs one `arg`, `rest`, `frame` or `self` read node per binding identity.
Graphs with separate equal read nodes therefore acquire canonical sharing and
can change graph bytes and hashes. A tagged undefined primitive becomes a fresh
literal occurrence at each use; arbitrary sharing of that identity-free tag is
also outside the raw graph domain. Primitive captures and equivalent duplicate
capture values can be compacted by canonical graph construction. Unused
nonprimitive capture inputs remain eager and are preserved. Source output
continues to refuse unused, primitive and duplicate frame layouts. These cases,
redundant comma anchors and the pure lazy splitting above are excluded from a
claim of raw graph identity. Their normalized graph and output text stabilize
on subsequent conversions; their established values, failures and sharing are
retained.

Eligible scalar tail recursion becomes a normalized loop with one parameter and
one result. The function initializes the loop from its fixed parameter and
returns the loop result. Its condition and transition regions are explicit;
common preparation chooses loop slots and immutable iteration snapshots.
Functions that require ordinary recursive identity retain their self binding.
The baseline preparation domain and its explicit deferred control-flow cases
are described in [`js/ast/prepare`](../../js/ast/prepare/README.md).

[`source`](source/module.f.mjs) is a separate source-spelling admission pass.
It retains the parser's representability restrictions and consumes the common
conversion's chosen definitions. It performs no second placement algorithm.
Canonical JavaScript bytes now come from prepared FAST, so names, grouping and
single-use temporary declarations may differ from the former direct graph
writers. Code-only function text still treats frame slots as external values
in signature order, without evaluating their initializers.
