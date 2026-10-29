# Source normalization

[`source.ts`](./source.ts) preserves resolved source declaration identities,
parameter patterns and defaults, assignments, guards, switches, conditional
loop statements, targeted loop/function exits and `while` loops. These constructs contain no generated
functions, capture frames or immutable assignment versions. The parser retains source legality and
diagnostics; representing a construct here does not admit new source syntax.

[`pattern`](./pattern/module.f.mjs) plans checked patterns before the complete
binding analysis. Its structural walk chooses iterable copies, property reads,
empty-pattern checks and hidden identities. The parser supplies name, key and
namespace admission callbacks and retains tokens for its diagnostics. One
complete `analyzeBindings` pass then classifies the original parameter and local
identities, including writes and references in nested or unreachable regions.

`normalize(resolved, imports)` consumes that admitted record and its shared
facts. It expands pattern reads and defaults, chooses invocation parameters and
rest layout, and maps every source declaration to its current immutable value.
Used aliases retain an established value and their lexical order, so generated
helper capture signatures survive source round trips. These retained reads add no
evaluation demand to their already established value. Unused aliases of already
established values are removed without introducing captures. Initializers and
assignment computations remain required even if a later write discards their
result. A late parameter's raw argument read is established once before default
selection; both the test
and the alternative name that binding. The fixed prefix preserves `length`.

Compound assignments retain their operator and source target until normalization.
Eager operators establish a new version from the previous value and the right
operand. Logical assignments use the shared logical selection predicate and
explicit branch results: only the selected arm establishes the right operand,
while the skipped arm has no definitions and yields the preceding version.
The parser's implicit-read and possible-write evidence remains part of complete
binding analysis even when the write is skipped at run time.

Terminal guards and switches become yielding value regions. They introduce no
invocation or capture boundary. A block normalized as a value — a source block
or a function called where it is written, which the scope around it goes on
after — keeps its writes to itself: the parser admits none that reaches a
binding established before the block, and normalization asserts it. A terminal arm, a
guard's or a case's block, needs no such check: nothing in the enclosing scope
runs after it, so a write in it is read by the arm alone, as JavaScript reads it.

A conditional statement inside a loop instead keeps the surrounding statement
continuation. Both arms normalize from the same preceding immutable mapping.
The union of the normally completing arms' assigned outer bindings becomes
explicit FAST branch results in binding-introduction order. Each normal arm yields its latest immutable versions,
retaining preceding versions for names it does not write. An omitted `else`
is an empty normal arm, preserving the original one-arm normalization.
Following statements read these results. Branch-local declarations do not
escape, required work stays inside the reached arm, and aliases needed for
result values survive pruning. `else if` is a conditional in the false arm;
nested conditionals use the same rule without a function boundary.
An abrupt arm retains its targeted transfer and supplies no normal results.
When both arms exit, the surrounding block has no normal continuation and
following statements are not normalized into executed work.

A switch statement inside a loop establishes its discriminant once, then tests
labels lazily in source order. Stacked labels use the same short-circuit join as
terminal switches. Each case starts from the same incoming immutable mapping;
case-local declarations remain local. Its own `break` skips the rest of that
case and resumes after the switch. An unmatched switch without a default keeps
the incoming values. The parser separately refuses case fall-through.

The switch is a one-pass FAST loop, with no inputs and explicit results for
assigned outer bindings in declaration order. Its breaks supply current values;
an absent default supplies unchanged ones. This uses existing transfer and
completion machinery rather than adding a switch operation. The nearest break
region and nearest repeated loop are independent: a switch changes only the
break owner, so `continue` retains the enclosing loop and retests its condition.
A nested `while` owns both transfers. Returns and throws keep their source
owners. An all-terminal switch has no normal continuation, and its following
computations are not normalized. Only actual transfers out of the repeated loop
count toward that loop's literal-true normalization; a switch-local break does
not. Every normalized loop root still ends in an explicit transfer. A switch's
unreachable root traps if a case ever falls through; it introduces no state
reads or helper captures. An unreachable repeated-loop fallback after
all-terminal nested regions transports existing input values, whose bindings
remain available even when unused assignment aliases were pruned. Later owners
can keep nested loops opaque without mistaking a placeholder yield for normal
loop-body completion.

Source `return` statements inside loops retain their resolved ordinary-function
target in FAST. They cross loop and conditional regions without becoming normal
results for a generated helper. Statement `throw` likewise remains an abrupt
exit, after its reached preceding work and value computation. Return operands
participate in the same reference pruning as other exits, retaining needed
parameters, rest values, captures and source aliases.

A loop selects established outer bindings that are mutable and read or written
in its source events, in binding-introduction order. Nested function/default
reads participate; loop-local declarations stay local. The same ordered list
supplies independent input parameters and normal result bindings, including
zero or multiple values. Entry values come from the current immutable mapping;
assignments choose successive immutable iteration values, and the final values
continue simultaneously. Normal completion updates source mappings for actual
writes only. A read-only carried value therefore does not invent a write that
escapes an enclosing immediate-call value region. Graph construction consumes
the explicit signature without source write analysis.

Nested source loops use this same rule recursively. Their reference/write
events participate in the enclosing loop's state selection, and their normal
results update the surrounding immutable mapping before later statements.
Declarations introduced inside an outer iteration stay local to that iteration;
an inner loop selects their established values at each reached entry. A binding
carried read-only by an inner loop does not invent an enclosing write.

Unlabeled `break` and `continue` retain their parser-resolved nearest eligible
target. The target's source signature packages the current immutable versions as
FAST transfer values in state order. A `continue` returns to the next condition
test; a `break` supplies normal loop results to following statements. A direct
exit stops normalization of the rest of that source block, while the parser's
complete binding facts still include unreachable references and writes.
Ordinary function boundaries, including immediate calls lowered to value
regions, clear both transfer owners before normalizing their own bodies.
For a literal-true loop with its own explicit exit, the step is already the
complete core body: no redundant always-true guard is added. This canonical
form keeps generic structured loop output stable on source reparse. A loop
without its own exit retains its established graph shape. An owning return or
statement throw also exits its enclosing loops, while an inner loop's own
`break`/`continue` and ordinary function bodies do not supply an exit to the
surrounding loop.

Ordinary functions consume analyzed source capture facts. Intermediate
functions forward values needed to construct deeper closures without inventing
source reference events. Captures establish the current immutable version when
the closure is constructed; normalized use pruning removes unused aliases and
unused invocation bindings. Safe immediate calls with no fixed parameters,
arguments or used rest binding become value regions.
An immediate call with an owning return inside its body or final value keeps
its ordinary function boundary, so that return stays local to the call. The
shared targeted return traversal determines this condition; a final return alone
retains the existing value-region spelling.

Import identities come from the module boundary. Equal supplied graph objects
share their established binding; primitive comparisons preserve `NaN` and the
sign of zero. Required input definitions retain unused and lazy-only module
loads. The resulting FAST contains no source assignment or mutable slot.

Logical syntax remains in `SourceValue`, independently of the canonical
operation vocabulary. [`logicalValue`](./logical/module.f.js) establishes a
left operand once in an immutable binding in the original expression region,
then selects the right operand or the established left value. An existing
reference is reused. The right operand stays in its selected yielding arm;
the normalization introduces no function boundary or eager outer temporary.
Nullish selection compares against null and primitive undefined with nested
conditionals. Switch label joins use this same lowering, so their graph is
the graph of the equivalent written logical expression. Normalized FAST and
canonical EDAG contain no logical or nullish operation tags.
