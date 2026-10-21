# Source normalization

[`source.ts`](./source.ts) preserves resolved source declaration identities,
parameter patterns and defaults, assignments, guards, switches and scalar
`while` loops. These constructs contain no generated functions, capture frames
or immutable assignment versions. The parser retains source legality and
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
helper capture signatures survive source round trips. Unused aliases of already
established values are removed without introducing captures. Initializers and
assignment computations remain required even if a later write discards their
result. A late parameter's raw argument read is established once before default
selection; both the test
and the alternative name that binding. The fixed prefix preserves `length`.

Terminal guards and switches become yielding value regions. They introduce no
invocation or capture boundary. A scalar loop gets an explicit input binding,
entry value, iteration body and separate result binding. Its assignments choose
immutable iteration versions; the normal iteration transfer continues with the
latest version. Graph construction consumes this signature directly.

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
