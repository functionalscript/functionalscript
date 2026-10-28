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

Before an array/call operand can transfer outward, the physical operand
sequencer materializes earlier reached spreads when establishing snapshots
before a statement prelude. It reuses the logical return pass's expansion
constructor. Merely retaining the iterable would defer a failed expansion until
after the transfer. Existing standalone and bare-callee control forms keep their
physical preparation domain. Member/optional calls use their shared chain
normalization, retaining lookup and selected expansion regions. Both serializers
receive explicit array constructions and ordinary spread references.

Object-entry metadata distinguishes spread operands from property keys and
values. Before a later control prelude, snapshots convert earlier keys to
strings and materialize earlier object spreads through the shared constructor.
Objects without a hoisted prelude retain their ordinary syntax. Own-property
copying retains UTF-16 string properties, enumeration and value identities.

A general loop has private parameter and result slots. Preparation establishes
every transfer operand in an immutable temporary before writing any destination
slot. Swaps and several state values therefore transfer simultaneously. Each
iteration first creates immutable parameter snapshots; closures capture those
snapshots rather than mutable slots. Slot mutability is recorded in the plan,
including loops that never update a parameter.

The source coordinator calls `prepare(block, { sourceLoops: true })` after
admitting the loop's transfers and source regions. In that profile, a
one-input/one-result loop shares one physical state slot: a continue
stores its next input, and a break stores its final result immediately before
leaving. Iteration snapshots and transfer temporaries retain their ordinary
lifetimes. The prepared `while` names its final result directly, avoiding a
second mutable source variable or an extra result alias on re-entry. Default
preparation and standalone function text retain the independent-slot plan.

A loop without a break to its own target cannot complete normally. Shared
preparation omits its result storage and projections, then stops following work
in the containing statement region. Result-free conditionals and statement blocks
carry that completion fact outward. Values and definitions retain conservative
completion, preserving existing expression and result-bearing region layouts.
Returns and throws still exit their exact owner;
ordinary nested function bodies do not supply an enclosing loop's break. The
prepared region ends with an empty unreachable yield, so both serializers omit
the unreachable suffix, including after unconditional tail loops.
For source functions alone, a proven-unreachable empty completion receives a
terminal return, satisfying the source block grammar after a diverging loop.
The last prepared `while` supplies its result alias so invocation-root
reconstruction remains exact; otherwise the unreachable return uses `undefined`.
A normally completing empty region retains its own signature.

The canonical scalar loop produced for existing source tail recursion becomes
a prepared `while`: its condition reads a fresh immutable snapshot of the
current slot, and its body establishes the iteration snapshot before executing
the transition. A transition that returns its unchanged parameter needs no
write and has `mutable: false`. This preserves the existing source loop
spelling while keeping slot selection common to both targets.

The shared [`plain-loop plan`](../loop/plain/module.f.mjs) also recognizes a
one-state helper with required entry definitions, a terminal condition, a
define-only continuing arm and one computed normal result. This is the shape
of aggregate helpers for plain source loops. Entry computations run in the
condition on every test, including the final false test. Only the transitive
primitive/reference/numeric-projection prefix needed by the body or normal
result is copied into those regions. Body copies are established immediately
before their first statement use, preserving source normalization around
unrelated initializers and selected branch results. Independent copies follow
the statement's read order, with transitive prerequisites before their users;
the condition retains its original complete prefix. Computations that create
identity or call functions remain in their original condition region; a dependency shared with
another region keeps the general loop form instead of being duplicated.

Preparation uses the existing `while` plan and immutable iteration snapshots.
An unchanged normal result directly names the loop result. A computed result
instead gets a real immutable final-state snapshot before its definitions and
value run once after the loop. Closures can capture that snapshot without
capturing mutable slots. Hidden nonlocal transfers retain the general control
plan. The scalar path and both serializers keep their existing contracts.

The same plain-loop plan admits an empty input signature, with the continuing
arm on either side of its terminal condition. Preparation gives this loop a
private unchanged slot initialized to `undefined`, without semantic parameter
snapshots or read aliases. Its normal result runs once after iteration. Source
renders the existing unchanged-slot assignment, so the first parse constructs
the canonical scalar helper directly. Public function arity stays zero; graph
and text stabilize from that first parse. Condition-only work and the existing
projection-only dependency restriction retain their normal lifetimes.

In the source profile, a plain loop with several semantic inputs uses one
private array slot. Its initial values run in order, and the entire next-value
array is established before the slot changes. Fresh numeric projections give
the condition, continuing body and final result immutable input snapshots, so
captured values keep the iteration that created them. Public function arity and
the logical loop signature stay unchanged. The first source parse introduces
the canonical scalar helper; subsequent graph/text cycles remain exact.
Default code-only JavaScript and Rust retain their existing independent-slot
layout for these logical loops.

Packed source steps expose leading total constructor definitions from eager
operand blocks before placing input projections. Primitives, established
references, and array, static-key object or closure constructions with
established operands can move without executing user work. Calls, property
reads, spreads and memo demands stay in their original order; lazy branches
and function bodies stay opaque. Bare calls retain their prepared call form,
so exposing a member-valued callee still uses the serializer's existing
detached-call spelling. This keeps shared argument allocations stable from
the first source parse while preserving earlier argument failures.

Observed-rest plain invocation loops use these same plans. Their logical
transition already establishes the argument vector before projecting fixed
inputs and creating a fresh rest slice. Rest occupies one semantic input;
rest-only roots therefore use the existing scalar slot, and fixed-plus-rest
roots use the packed slot. Immutable snapshots preserve rest sharing within an
invocation, fresh empty or nonempty arrays between iterations, and held captures.
Preparation does not change the public fixed arity or rest parameter.

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
