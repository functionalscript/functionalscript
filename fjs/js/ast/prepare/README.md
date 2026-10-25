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
An abrupt-only normalized region can retain an unreachable empty yield.
Result-slot writes use only established yielded temporaries, so those regions
never introduce references to missing values into target syntax.

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

The shared FAST [`returns`](../returns/module.f.mjs) pass exposes owning returns
at member and optional-call boundaries before physical lowering. Preparation
invokes it with the current function owner and refreshes the summary for the
new regions and bindings. Lookup remains before arguments, member calls retain
their receiver, and skipped optional regions retain their continuations,
including later forced calls. Both target writers use this common plan.
The direct `()` call of a plain `.` callee canonicalizes to a member call,
matching graph construction even when no operand returns. Its existing
physical loop transfers retain their exact active targets; graph operand
admission keeps its stricter enclosing-loop boundary.
Outer-loop transfers in chain operands and nonlocal transfers in lazy-definition
initializers retain their existing refusals. Throws retain their existing
failure propagation.

An immutable postorder summary records outward control targets and fresh-index
requirements once. Suspended immutable tasks then prepare syntax without using
the host call stack for syntax depth. The direct scoped proofs cover 20,000
nested unary operations, binary operations, property accesses and final-value
blocks containing required definitions. This is evidence for those preparation
shapes; target parser and runtime limits belong to their respective boundaries.

Logical source spellings reach this pass as required definitions and explicit
conditionals. Preparation has no separate short-circuit lowering policy: it
preserves the established left operand and the selected conditional region.
