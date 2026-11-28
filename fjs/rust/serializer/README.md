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
Its demand callable uses a borrowed `dyn Fn` reference, keeping memo dependency
diamonds out of nested anonymous closure types while retaining lexical capture
lifetimes and stack allocation.

Array and call spreads emit `spread_item(operand)?` at each item's position.
This establishes the iterator before any later operand can run, so a reached
invalid spread fails before a later throw or divergent call. Receiver lookup
still precedes arguments, and optional calls keep their argument list in the
selected callable. Only immutable arrays and strings are iterable; their
iteration cannot throw or run represented code. `spread_array` can therefore
consume established iterators after evaluating the items while retaining its
length and allocation checks. This does not change allocation-failure timing.

Computed object keys emit `property_item((key).to_string()?, value)`. Rust
finishes the first argument before evaluating the second, so each key is
evaluated and converted once before its value starts. A failed conversion
propagates immediately. The key expression is grouped to retain block and
conditional receivers; static string keys retain their typed literal spelling.

`bindingTagged` spells a declaration under a caller-supplied name through the
same declaration path as ordinary prepared bindings. The corpus supplies its
named values through [common graph conversion](../../edag/to_fast/README.md),
including values reached once. The [EDAG adapter](../../edag/rust/module.f.js)
preserves their identities and dependencies. `External` entries associate
already established binding identities with Rust expressions and optional
import uses; the target does not rediscover those bindings.

Binding and loop target object identities determine names. Diagnostic indices
provide readable stems, with distinct suffixes when different identities have
equal indices. Parameters use their argument positions. In native output a
module-level function whose captures are all static and whose body needs no
runtime can have a `StaticFunction` descriptor. Its body reads captured
constants directly and loads its own descriptor for a self-reference.
Functions created at run time read their captures by frame position.
`Options.runtime` supplies the runtime expression for operations that need
it, and `Options.text` supplies each prepared function's represented source
text.

A group created at run time shares one capture frame across its members.
The serializer emits one `A::function_group` call. Each body uses `A::group_member`
to reach a sibling, including siblings returned as values. When the native
backend can resolve the captures and every member at compile time, it emits a
`StaticFunction` descriptor per member. Those bodies name the descriptors
and their captured constants directly. Portable `.rs` modules use the group
constructor for both cases. Their `IStaticFunction` bound includes VMs whose
function values can only be constructed at run time. Loading a named Rust
descriptor requires the concrete backend's `IStaticVm` capability.

A terminal loop exit uses the same labelled `loop { ... }` spelling as a loop
statement. It is the block's final expression, with no normal result or
synthetic fallback. Returns and throws in its body retain their enclosing
function's owner.

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

Function item wrappers belong to the [compiler](../../compiler/rust/module.f.js)
and [corpus generator](../../nanvm/rust/module.f.js). Their precise
`clippy::if_same_then_else` allowance preserves condition evaluation when
source arms happen to agree. Item formatting attributes also belong there;
the serializer performs no branch simplification or temporary placement.

Source `&&`, `||` and `??` reach this stage as conditional regions. The native
`Any::logical_and`, `Any::logical_or` and `Any::nullish_coalescing` backend
helpers were removed with their graph tags; canonical conditional selection
and the independent native JavaScript corpus cases retain their semantics.
