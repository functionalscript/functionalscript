# Prepared FAST to Rust

This module spells the [prepared FAST model](../../js/ast/prepare/README.md)
against the `nanvm-lib` API. Common conversion and preparation have already
selected shared bindings, evaluation regions, memo lifetimes, loop storage and
transfers. The serializer chooses Rust names, grouping, declarations, runtime
operation calls and token marks.

`scopeTagged(block, options, external)` returns marked statement lines and
import-use metadata in a `Result`. `scope` removes the marks from those same
lines. `valueTagged` renders one value; its `result` flag selects a
`Result<Any<A>, Any<A>>` expression instead of an `Any<A>` expression. Nested
fallible operations propagate with `?`, so callers provide a Result-returning
Rust context. Lazy operands use Result-returning callables. A prepared memo
stores its first successful value and leaves a failed initialization uncached.

`bindingTagged` spells a declaration under a caller-supplied name through the
same declaration path as ordinary prepared bindings. The corpus supplies its
named values through [common graph conversion](../../edag/to_fast/README.md),
including values reached once. The [EDAG adapter](../../edag/rust/module.f.mjs)
preserves their identities and dependencies. `External` entries associate
already established binding identities with Rust expressions and optional
import uses; the target does not rediscover those bindings.

Binding and loop target object identities determine names. Diagnostic indices
provide readable stems, with distinct suffixes when different identities have
equal indices. Invocation parameters and captures use their explicit argument
and frame positions. `Options.runtime` supplies the runtime expression for
operations that need it, and `Options.text` supplies each prepared function's
represented source text.

Marked and plain scopes agree after demarking each line. Keywords and
initializer literals retain their token kinds. Import metadata records unique
VM and unstable helper names; `useLinesTagged` and `useLines` add the requested
VM bound and format the imports. Operations requiring an unavailable runtime
return an error with a reason and detail. The input contract is well-formed
prepared IR; graph shape and invocation admission belong to the adapter.

Naming, expression spelling and continuation spelling use explicit work
stacks. Final value regions share a lexical Rust block while retaining their
ordered definitions and final transfer. Proofs exercise 20,000-node unary,
binary, property-continuation and final-region trees, including regions with
required definitions. This depth guarantee covers admitted prepared IR;
separate raw graph admission retains its own domain.

Function item wrappers belong to the [compiler](../../compiler/rust/module.f.mjs)
and [corpus generator](../../nanvm/rust/module.f.mjs). Their precise
`clippy::if_same_then_else` allowance preserves condition evaluation when
source arms happen to agree. Item formatting attributes also belong there;
the serializer performs no branch simplification or temporary placement.
