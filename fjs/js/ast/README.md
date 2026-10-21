# Foundation AST

FAST records execution steps with explicit value identities, evaluation regions
and structured control flow. It is compiler IR; representing a construct here
does not admit its JavaScript spelling as FunctionalScript.
[Compiler architecture](../../compiler/architecture.md) names the stage owners.

`types.ts` defines normalized FAST. A `BindingId` is an object identity. Its
`index` is a deterministic presentation aid; equal indices do not alias
bindings. Function and loop targets are likewise identities, independent of
printed names. Producers allocate these identities and preserve them through
references, captures and transfers.

A `Block` contains ordered statements followed by an explicit exit:

- `define` establishes one immutable value. `required` evaluates at that
  position even if no result needs it. `lazy` establishes it at its first
  reached use and retains it within its owning invocation or iteration.
- `block` and `if` bind their declared results on normal completion. `yield`
  supplies those results without creating a function or invocation boundary.
- `loop` declares ordered parameters and entry values, independently of its
  result bindings. `continue` computes all next values before transferring
  them simultaneously; `break` supplies the results and resumes after the loop.
- `return` names its owning function; `throw` uses the existing failure
  channel. Abrupt exits supply no normal block results.

A block or conditional used as a `Value` yields exactly one result. The
statement variants support several results. Function parameters, rest, self,
captures and local definitions all use the same immutable reference form.
Captures pair an inner binding identity with the value established at function
construction. No closure captures a mutable implementation slot.

`Operator<V>` retains the existing operation vocabulary while parameterizing
its value operands. `mapOperator(map)(operator)` maps those operands, including
computed keys, spreads and optional-chain continuations, without interpreting
metadata as values. `operatorOperands(operator)` lists the same operands in
stable source order. Neither helper changes evaluation regions; traversing a
lazy operand does not establish its runtime value. The logical operators
remain during the baseline migration and are removed by the later schema step.

`analyzeBindings(scope)` consumes the resolved, pattern-expanded binding stage,
before assignment normalization or graph construction. Each scope declares the
same binding identities for locals and parameters. Its events distinguish
`initialize`, `read` and `write`; nested `region` events retain the source
function, while nested `function` events introduce a capture boundary.

The analysis returns each binding's `isMutable` flag and ordered, deduplicated
`capturedBy` targets. Each target names the source function containing a direct
resolved read or write; forwarding a value through an intermediate generated
frame does not add a source reference. Any write in the complete source scope makes a binding
mutable, including later, nested or unreachable writes. Initialization never
does. This records facts; source declaration legality and capture admission
remain the compiler's policies. In particular, computing the new facts does
not itself enable the broader source policy.

Normalized FAST has no reassignments. `from_fast` consumes it without
rediscovering source writes or loop state. Output preparation owns physical
slots, simultaneous updates, invocation resets and capture snapshots; target
serializers consume that prepared form. Graph round-trip claims apply before
physical preparation, under the graph domains in the architecture document.

[`sugar`](./sugar/README.md) owns the resolved source constructs, structural
pattern plans and their normalization after shared binding analysis.
