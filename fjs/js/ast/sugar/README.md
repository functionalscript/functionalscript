# Source normalization

[`source.ts`](./source.ts) preserves resolved source declaration identities,
parameter patterns and defaults, assignments, guards, switches, conditional
loop statements, targeted loop exits and `while` loops. These constructs contain no generated
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

Unlabeled `break` and `continue` retain their parser-resolved innermost target.
The active loop's source signature packages the current immutable versions as
FAST transfer values in state order. A `continue` returns to the next condition
test; a `break` supplies normal loop results to following statements. A direct
exit stops normalization of the rest of that source block, while the parser's
complete binding facts still include unreachable references and writes.
Ordinary function boundaries, including immediate calls lowered to value
regions, clear the active loop before normalizing their own bodies.
For a literal-true loop with its own explicit exit, the step is already the
complete core body: no redundant always-true guard is added. This canonical
form keeps generic structured loop output stable on source reparse. A loop
without its own exit retains its established graph shape; nested loops and
ordinary functions do not supply an exit to the surrounding loop.

Ordinary functions consume analyzed source capture facts. Intermediate
functions forward values needed to construct deeper closures without inventing
source reference events. Captures establish the current immutable version when
the closure is constructed; normalized use pruning removes unused aliases and
unused invocation bindings. Safe immediate calls with no fixed parameters,
arguments or used rest binding become value regions.

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
