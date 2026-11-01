# Foundation AST

FAST records execution steps with explicit value identities, evaluation regions
and structured control flow. It is compiler IR; representing a construct here
does not admit its JavaScript spelling as FunctionalScript.
[Compiler architecture](../../compiler/architecture.md) names the stage owners.
[`fjs/compiler/sugar`](../../compiler/sugar/demo.f.mjs) draws FAST as a graph,
beside the source AST it is normalized from.

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
- A terminal `loop` is the block's exit. It has no break to its own target,
  no normal results and no following continuation. Owning function returns,
  failures and continued iteration retain their existing meanings.
- `return` names its owning function; `throw` uses the existing failure
  channel. Abrupt exits supply no normal block results.

A terminal loop ends its block without an invented throw or implicit returned
value after it.

A block or conditional used as a `Value` yields exactly one result. The
statement variants support several results. Function parameters, rest, self,
captures and local definitions all use the same immutable reference form.
Captures pair an inner binding identity with the value established at function
construction. No closure captures a mutable implementation slot.
Capture expressions evaluate in order in the enclosing function. Return lifting
establishes earlier captures before a later expression can return to that owner;
such a return skips the remaining captures and closure construction. Normal
completion constructs the function from the established capture values. Its
body retains its own function target and normalization boundary.

Owning returns in lazy initializers occur at first reached demand. Private
getter outcomes relay that return to the exact source function; a returning
initializer skips its consumer and following work, while normal completion
installs the shared value. Getter construction keeps lazy prerequisites
deferred, including dependencies mentioned only in an unselected arm. The
logical demand pass preserves caller, iteration and recipe-local lifetimes
before graph construction or physical getter lowering.
Caller and initializer planning share an eager lexical inventory of operand
blocks, loops and computed lazy locals. Operands reuse the caller's selected
cells and prerequisites; local getters start at reached declarations. Cell
lifetimes follow enclosing iterations through operands, while loop-transfer
ownership remains local to the operand's statement regions. Ordinary function
bodies and deferred initializers retain separate planning boundaries.
Selection also inspects deferred initializers for helper crossings that need
caller-owned cells. Such a crossing selects the initializer's owner and its
connected lazy prerequisites and dependents before constructing recipes; it
does not evaluate an initializer. Declaration-time aliases and shadows govern
the lookup. Nested recipes propagate that need to their owning declaration,
while ordinary function bodies remain opaque. An unrelated local loop does
not select a caller dependency read only outside that loop.
Graph lowering plans each owner's eager regions once, then starts fresh at
ordinary function and deferred-initializer boundaries.
This includes cells declared in loops inside an initializer: each reached
declaration starts a fresh cell, while repeated demands and nested loops share
that iteration's value. Escaping closures retain the established value.
Initializer-loop entries use the enclosing cells; narrower prerequisite calls
preserve the current local suffix. Returns propagate to the source function,
and loop transfers stay within the operand's locally owned loop chain.
Selected normal-only memo plans also sequence member and optional calls.
Optional skips keep keys, arguments and their cells undemanded. Reached member
lookup precedes arguments, direct method calls retain their receiver, and
wrapped property values keep detached invocation. Member-call argument spreads
use the same reached expansion order. Normal plans also sequence standalone
array/call spreads and object entries. Each reached spread expands or copies
before later operands; object keys convert before their values, with or without
spreads. Selection also recognizes exact prepared declaration and loop
occurrences inside operands, so locally owned cells stay within their selected
evaluation region. The scan follows eager regions and capture expressions;
ordinary function bodies and deferred initializers keep separate boundaries.
[`memo`](./memo/module.f.mjs) owns this shared normalization and cell planning;
[`control`](./control/module.f.mjs) supplies lexical dependency facts. The former
graph-owner module paths retain compatibility exports.

`break` and `continue` payload expressions can return to the enclosing function.
Return lifting establishes earlier payloads in order; a return skips the
remaining payloads and the transfer. Normal completion retains the exact loop
target and ordered result or next-state list. A continue establishes every next
value before transferring, preserving simultaneous state updates.

Loop entry expressions evaluate once, in order, in the enclosing scope before
the new target and parameter bindings become active. Return lifting establishes
earlier initializers before a later expression can return to the enclosing
function; that return skips the remaining initializers, loop and following
work. Normal completion enters the loop with those established values in
declared parameter order, preserving its target and result bindings.

`Operator<V>` retains the existing operation vocabulary while parameterizing
its value operands. `mapOperator(map)(operator)` maps those operands, including
computed keys, spreads and optional-chain continuations, without interpreting
metadata as values. `operatorOperands(operator)` lists the same operands in
stable source order. Neither helper changes evaluation regions; traversing a
lazy operand does not establish its runtime value. `CoreBinaryTag` excludes
logical and nullish source operators; source sugar expresses them with
immutable bindings and conditional result regions.
Member chains retain the [EDAG chain states](../../edag/types.ts): plain property
paths nest accesses, and property continuations stay inside an open optional
region. The shared `Step<V>` shape does not replace those producer invariants.

`['memberPresent', receiver, key]` is an internal Boolean query using the same
`Key<V>` vocabulary as property access. Its operands are the receiver followed
by the value inside a computed `['Number', value]` key; literal keys remain
metadata. It resolves the member without evaluating call arguments or checking
callability. The graph conversion and runtime writers support this form;
source admission has no spelling for it. The shared
[`returns`](./returns/module.f.mjs) pass lifts owning returns through member and
optional-call operands before graph construction or physical preparation. It
retains required lookup, receiver binding and optional-region boundaries;
target writers consume the resulting explicit control flow.

Spread-bearing arrays and calls use the same sequencer. Each reached spread
materializes into an internal array before a later operand can return; normal
output spreads that established array. Member lookup and optional guards stay
outside or around the selected argument expansions as their contracts require.
Object entries use entry-aware operand positions: keys convert before values,
and spread operands materialize through the ordinary own-property kernel.
Normal results retain enumeration, duplicate keys and value identities.

Established static and intrinsic callable leaves and the `entry`/`hasEntry`
helpers retain bare-callee provenance through value blocks, conditionals and
comma results. Argument return lifting snapshots the callee before arguments,
preserving static lookup failures before a later argument can return. Only
normal argument completion invokes the established callee; a return skips the
remaining arguments and spreads.

Property-ending chains supply values with the same callee tracking. Ordinary
calls through value blocks, comma results and conditionals establish the
selected property read before arguments and retain detached invocation. Prefix,
receiver, key-conversion and read failures precede later argument returns;
unselected callee arms stay unevaluated. Direct syntactic member calls and
in-chain optional calls retain their receiver and query protocol.
JavaScript rendering keeps ordinary property callees detached after erasing
trivial result blocks or rendering singleton comma expressions as parentheses.

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

The complete declaration index groups references by binding identity once;
stable grouping retains each binding's source reference order. One cursor then
collects writes and capture targets without rescanning all references for each
declaration. Grouping costs O(R log R + B) for R references and B declarations.

Normalized FAST has no reassignments. `from_fast` consumes it without
rediscovering source writes or loop state. Output preparation owns physical
slots, simultaneous updates, invocation resets and capture snapshots; target
serializers consume that prepared form. Graph round-trip claims apply before
physical preparation, under the graph domains in the architecture document.

[`sugar`](./sugar/README.md) owns the resolved source constructs, structural
pattern plans and their normalization after shared binding analysis.
