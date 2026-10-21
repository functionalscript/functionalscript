# Canonical invocation roots

`invocationRootOf` extends the scalar root domain to an ordered fixed invocation
signature and one whole public result. It requires no rest binding, only aliases
of fixed arguments before the loop, matching positional entry values, and a
direct return of the loop result to its owning function. One-time computation,
changed input order and following result processing do not qualify.

`directInvocationRoot` resolves the matched loop's statement transfers before
ordinary graph construction. Own continues become direct calls of the same
function; breaks and owner returns become its direct public result. Other
function boundaries remain ordinary functions. Inputs and results are opaque:
the pass never guesses a private protocol from array contents or adds another
helper/result wrapper. The existing scalar path remains first.

Normal regions remain on the existing constructor path. An immutable summary
and continuation worklist keep terminal statement depth off the host stack
without duplicating normal branch suffixes. General helper composition and
nonlocal operand control remain in the
[open loop-construction task](../../../todo/fast-loop-construction.md), alongside
the rest/default/spread invocation work coordinated with tail-call analysis.
