# Common FAST preparation

`prepare(block)` and `prepareFunction(function)` consume trusted normalized
[FAST](../README.md) and produce the physical plan shared by the JavaScript and
Rust serializers. Producers establish binding and target identities, result
arities and lexical ownership. Preparation trusts those invariants; it does
not admit source syntax, inspect EDAG reachability or choose graph value owners.
The standalone function entry point requires normally completing capture
values. A construction whose capture evaluation can transfer to its enclosing
scope is prepared as a value in that containing region instead.

Required definitions remain ordered immutable definitions. A lazy definition
becomes a memo declaration with private value and completion slots and a
prepared initializer region. Its references become explicit demands. Each
execution of the declaration creates fresh storage, so invocations and loop
iterations retain separate first-demand lifetimes. A failed initializer leaves
the completion flag unset. Serializers implement that declared memo protocol;
they do not decide where a value is established.

Result blocks and conditionals use private result slots when their control
must remain in the containing statement flow. A return still exits its owning
function, and a transfer still names its owning loop. Ordinary expression
regions retain their value shape. When a child expression requires statements,
earlier operands are established in immutable temporaries before those
statements, preserving evaluation and failure order.

A general loop has private parameter and result slots. Preparation establishes
every transfer operand in an immutable temporary before writing any destination
slot. Swaps and several state values therefore transfer simultaneously. Each
iteration first creates immutable parameter snapshots; closures capture those
snapshots rather than mutable slots. Slot mutability is recorded in the plan,
including loops that never update a parameter.

The canonical scalar loop produced for existing source tail recursion becomes
a prepared `while`: its condition reads a fresh immutable snapshot of the
current slot, and its body establishes the iteration snapshot before executing
the transition. A transition that returns its unchanged parameter needs no
write and has `mutable: false`. This preserves the existing source loop
spelling while keeping slot selection common to both targets.

The baseline output domain has no nonlocal return or outer-loop transfer in
an optional-chain operand, a continued member-call operand, or a lazy-definition
initializer. Preparation explicitly refuses those cases. Hoisting a chain
operand would make skipped work eager or move it before receiver resolution;
putting a nonlocal transfer inside a memo function would change its owner.
Physical receiver/callee continuations and deferred-control lowering belong to
the later expansion of this pass. These limitations do not narrow normalized
FAST's control-flow contract. Throws retain their existing failure propagation.

An immutable postorder summary records outward control targets and fresh-index
requirements once. Suspended immutable tasks then prepare syntax without using
the host call stack for syntax depth. The direct scoped proofs cover 20,000
nested unary operations, binary operations, property accesses and final-value
blocks containing required definitions. This is evidence for those preparation
shapes; target parser and runtime limits belong to their respective boundaries.
