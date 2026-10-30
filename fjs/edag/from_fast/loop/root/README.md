# Canonical invocation roots

`invocationRootOf` extends the scalar root domain to an ordered fixed invocation
signature and one whole public result. It supports zero through sixteen fixed
parameters, following the shared function-length limit. An observed rest binding
adds one internal loop input without changing the function's fixed arity. Only
aliases of invocation inputs, captures and self may precede the loop. It requires
matching positional entry values and a
direct return of the loop result to its owning function. One-time computation,
changed input order and following result processing do not qualify.

The body must read invocation inputs through the loop's iteration bindings.
Original function parameters and their transitive prefix aliases retain entry
values in normalized FAST, so a free body reference to one of them prevents
root reuse. The same check protects the established scalar path. Scalar and
aggregate helper construction capture retained entry values where root reuse
would replace them on a subsequent invocation.
Capture/self aliases remain stable, and ordinary nested functions expose only
their capture values to this check. No cross-iteration stability analysis runs.

`directInvocationRoot` resolves the matched loop's statement transfers before
ordinary graph construction. Own continues become direct calls of the same
function; breaks and owner returns become its direct public result. Other
function boundaries remain ordinary functions. Inputs and results are opaque:
the pass never guesses a private protocol from array contents or adds another
helper/result wrapper. The existing scalar path remains first.

Rest transitions use the exact shared [`js/ast/invocation`](../../../../js/ast/invocation/module.f.js)
recipe: a final required private argument array, fixed-prefix reads, and a
fresh slice for the next rest value. All arguments and spreads finish before
state updates. The matcher rejects borrowed rest arrays or other transition
layouts. Reconstruction removes that private final definition and recovers the
original call arguments, preventing argument-vector wrappers from accumulating
on repeated conversions. Existing binding identities, including shadowed source
occurrences, keep their lexical evaluation owner.

A rest root whose value operands or nested loop bodies contain an outer transfer
uses ordinary helper construction instead: its fresh-rest recipe has not been
established at that hidden transfer. Ordinary nested function bodies keep their
own boundary. Reached direct statement regions are validated without inspecting
unreachable suffixes or evaluating constant conditions.

Nested loop statements remain at their reached execution point for ordinary
graph construction to build their own helpers. This resolver does not rewrite
the inner body's transfers as outer transitions. Normal inner results return
to the caller before it continues its work. Completion normalization can insert
caller dispatches for enclosing-function returns and enclosing-loop transfers.
This resolver performs its own targeted break or continue without wrapping the
root's public results or self calls; intermediate helpers return to their caller
before that dispatch.

The resolver preserves statement result regions for the graph constructor's
normal/control joins. Each normal join binds selected results and constructs
one following graph, shared across normal exits. Terminal public results and
self calls remain direct. No continuation function or eager terminal-payload
envelope is introduced. The resolver does not cross value operands or ordinary
nested function bodies.

Normalized loop bodies require an explicit `continue`, `break`, owning
`return` or failure on every reached path. `yield` supplies an inner result
region; it is not a loop-body transfer. The constructor refuses a loop body
that reaches `yield`, regardless of its payload. Prepared target loops are a
later representation and do not define normalized fallthrough semantics.

Wholly normal regions retain their established graph path. An immutable
continuation worklist rewrites statement transfers without copying their
following suffix or consuming host stack with statement depth. Body prefixes
retain their required/lazy modes and lexical order. Owning-function returns
from admitted operand regions are lifted by the shared FAST return pass before
root reconstruction. Loop transfers still require a locally owned target.
Rest/default/spread invocation transitions use the same contract as
[tail-call analysis](../../../to_fast/README.md#tail-call-eligibility).
