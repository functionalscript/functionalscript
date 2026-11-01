# One-pass invocation joins

`_recoverOnePassJoin(function)` matches the existing canonical invocation-root
profile: one loop result is returned immediately by its owning function, and
loop entry values follow the function's established input bindings. It reuses
the invocation resolver to restore statement-level breaks as owning returns.
The recognized prefix contains only reads of established input/capture aliases;
those aliases and immutable iteration inputs become ordered required entry
snapshots. Arbitrary lazy definitions remain outside this profile. Parameters,
rest and captures retain their original function metadata.

The initial recovery profile requires iteration binding identities to be fresh
at the function root. A binding already declared as a function parameter,
capture, rest input or prefix alias keeps its original loop scope. Equal debug
indices do not affect this decision; only binding identity does.
The same restriction applies to body or false-arm declarations that would move
to the function root: they may neither shadow an existing root binding nor
collide with another declaration moved there. Their existing loop scopes remain
in place until a broader scope-preserving reconstruction is implemented.

The resolver introduces a fresh self binding for any restored backedge. A use
of that binding keeps the original loop, preserving genuine iteration and tail
transitions. Functions already using self also retain their existing plan.

Recovery completes only when the existing single-result immutable-join pass
accepts the restored body. Lazy definitions, broader joins, nested loops and
hidden transfer/value regions keep the original function and loop target. No
second transfer walker or owner/result-arity admission pass is introduced.
The reused invocation-root helpers consume normalized FAST only; their existing
`edag/from_fast` location introduces no graph analysis here. Relocating that
shared API belongs to the compiler architecture work.

Common preparation uses this profile for default JavaScript and Rust output.
The FJS source profile keeps its current loop reconstruction and readback domain;
this pass does not extend source syntax or graph/text identity guarantees.
