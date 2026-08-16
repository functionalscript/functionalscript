# AST stage 1: discussion

**Status:** open — working document for designing the stage 1 function AST.
Each subject below is resolved separately; once all are **decided**, the
result is distilled into a concrete design in [ast-spec.md](./ast-spec.md)
and this document is deleted.

## Baseline: a computation DAG with anchored evaluation

*This baseline supersedes the original index-based sequence proposal; the
revision history is recorded in subjects 1 and 8.*

A function body is an **array of operation nodes** — the *anchor list*:

- entries mirror the source `const` statements in source order; the last
  entry is the result;
- an operation node is:
  - a **non-object, non-array value** — a constant: `"hello world"`, `2.5`,
    `false`, `undefined`, `null`, `34n`;
  - an **object** — an object constructor; each property value is an
    operation node;
  - an **array** — a tagged tuple `[command, ...parameters]`:
    - `["array", ...nodes]` — array constructor,
    - `["args"]` — the array of arguments passed to the function
      (subject 2),
    - `["at", node0, node1]` — `node0[node1]`,
    - `["call", node0, node1]` — `node0(...node1)`,
    - `["bindCall", node0, node1, node2]` —
      `node0[node1](...node2)`.
- operand positions hold **real references** to nodes, not indices.
  Referencing the same node from two positions is **semantic sharing**: the
  node is evaluated once and its result reused. `const x = {}` then
  `[x, x]` yields an array with `a[0] === a[1]`, while `[{}, {}]` yields
  two distinct objects.
- evaluation: anchor-list entries evaluate in order; every node is
  memoized by its identity; anonymous operands evaluate depth-first,
  left-to-right — which is exactly JS evaluation order (subject 8).

The graph cannot be serialized as JSON (sharing would be lost — and
sharing is semantic), but it serializes as **DJS** (`const` + reference):
the AST's sharing structure and DJS's graph structure are the same thing.

```js
// const f = (...a) => { const x = a[0]; return [x, x] }
const x = ["at", ["args"], 0]
export default [x, ["array", x, x]]
```

Agreed points (not under discussion):

- Host-value reuse follows [DESIGN.md §8](../DESIGN.md): constants describe
  themselves; tags only where the host value is ambiguous. `["array", ...]`
  is a complete escape hatch — any constant array is expressible.
- `bindCall` is semantically required, not an optimization:
  [property-accessor](../spec/todo/2330-property-accessor.md) shows
  `a.indexOf(x)` and `const p = a.indexOf; p(x)` differ observably.
- `call`'s arguments are a single node yielding an array (usually
  `["array", ...]`): handles spread `f(...xs)` for free, unlike a variadic
  form. Same for `bindCall`'s third operand.

## Subjects

### 1. Structure: indices vs. nesting vs. references

**Status:** decided (revised)

**Resolution: the AST is a DAG of operation nodes connected by real
references; there is no index space and no normal form — the AST mirrors
the source structure and the hash takes it as written.**

History: this subject was first decided as "flat sequence with
`["local", index]` references plus nesting, mirroring the source". The
reference model replaces the index space entirely — the host language
already has references, so the AST should not invent an index scheme on
top of them ([DESIGN.md §8](../DESIGN.md) taken to its logical end). The
`["local", i]` command is removed.

Kept from the original decision, unchanged:

- **The AST mirrors the source; no normalization.** A source subexpression
  is an anonymous nested operand; a source `const` is an anchor-list entry
  that other nodes reference. Sharing cannot be inlined away (it is
  observable: `{} === {}` is `false`), and reordering is constrained by
  throw order (subject 8) — so neither "maximally flat" nor "maximally
  nested" is a valid normal form. Hash identity = structural identity of
  the graph as written (the name-erased source); hash equality does not
  decide semantic equivalence (same stance as Unison).
- **Lowering is one-way and lossy.** Lifetime and slot management — `pop`,
  top-relative indexing, auto-consuming RPN stack schemes — belong to the
  VM-internal bytecode
  ([vm-command-format](../spec/todo/vm-command-format.md),
  [call-like-instructions](../spec/todo/9100-call-like-instructions.md),
  [function-frame](../spec/todo/3111-function-frame.md)), whose generator
  does liveness analysis. Restoring the AST from bytecode is neither
  required nor generally possible: the function always carries its AST.
- **The AST is the single input to multiple processors**: the bytecode
  interpreter, the `toString(f)` source printer (anchor entries print as
  `const` lines, anonymous operands as expressions), and AOT backends
  (Rust, potentially WASM or machine code). Its structure is preserved
  because those backends exploit it; the interpreter may realize scopes as
  dynamic frames and pass whole frames to closures, while a bytecode
  backend may compute capture sets and copy — both derivable from the AST,
  neither expressible in it.
- Cost accepted: a tree-walking interpreter recurses on operand depth; a
  hostile AST can threaten the native stack. Answer: a documented
  implementation limit and/or internal lowering to a stack form — the
  interpreter's concern, not the format's.

Indices reappear only as **derived artifacts**: canonical serialization
(subject 9) and bytecode both derive them from the graph; they are never
authored and never part of the AST.

### 2. Arguments reference

**Status:** decided

**Resolution: a zero-parameter `["args"]` command yields the array of
arguments passed to the function.**

- The arguments array is first-class and always an array — the actual
  arguments the caller passed, whatever the declaration looked like.
  Missing arguments read as `undefined` via ordinary array indexing; extra
  arguments are simply present; forwarding is `["call", f, ["args"]]` —
  all ordinary array semantics, matching JS.
- Declared parameters are a compiler-side naming convention over the
  arguments array, not an AST concept; declared arity matters only for
  `.length` and `toString(f)` fidelity (subject 7).
- The rejected `["arg", i]` (single-argument access, no reified array)
  cannot express rest parameters (`(...xs) => xs`) or forwarding;
  `["arg", i]` is expressible as `["at", ["args"], i]` while the reverse
  is not.

Examples — named parameters are positions in the arguments array; the
compiler erases names:

```js
const f = (...a) => a[5]   // [["at", ["args"], 5]]
const g = (a) => a[5]      // [["at", ["at", ["args"], 0], 5]]
```

### 3. Lazy operators and the branch extension path

**Status:** decided (for what stage 1 must guarantee)

`?:`, `&&`, `||`, `??` ([operators](../spec/todo/2340-operators.md)) are
lazy, and operations throw — so eager evaluation of both sides is
observably wrong. Stage 1 ships no branches; it must only keep the door
open:

- **Operand shapes are specified per command** ("`at` takes two operation
  nodes"), never by a global rule like "an array in operand position is
  always a tagged operation" — so future commands with differently-shaped
  operands are additions, not breaking changes.
- Recorded extension path: `["cond", condNode, thenNode, elseNode]` where
  laziness is a property of the operand *position*. A branch operand is an
  ordinary node — including, when the branch body has its own consts, a
  nested anchor list carrying that branch's effect order (subject 8).
- The reference model dissolves the scoping problem that the index model
  had: there is no index space to scope, no De Bruijn `(up, index)`
  machinery; sharing across a lazy boundary is a plain reference, and a
  node demanded from two branches evaluates at most once (memoization).
- Deferred to stage 2 (`function` node): nested functions make `["args"]`
  context-dependent (whose arguments?) — see the open corner in subject 9.

### 4. Object constructor: key order and duplicate keys

**Status:** decided

**Resolution: property order is semantic** — properties evaluate in the
order written, per JS insertion-order semantics, which subject 8 adopts
exactly. Sorted-key canonicalization (as `fjs compile` applies to data
output, [spec/README.md](../spec/README.md)) must **not** be applied to
object constructors: reordering keys reorders evaluation of throwing
operands. Duplicate keys are a validation error.

### 5. Validation

**Status:** open (list agreed in direction, details when the RTTI schema
is written)

The AST is the `Function` constructor's public input and will see shapes
the FJS compiler would never emit. To validate:

- constants: function values in constant position are a validation error
  (until a `["function", ...]` node exists,
  [function](../spec/todo/3110-function.md));
- the body: must be a non-empty array — "the last entry" must exist;
- unknown command tags: validation error;
- duplicate object-constructor keys: validation error (subject 4);
- **acyclicity**: DJS cannot express cycles (const-before-use), but an
  `Any` handed to the `Function` constructor can be built by other means —
  cyclic node graphs must be rejected;
- aliasing is *not* an error anywhere — referencing the same node from
  many positions is the sharing mechanism (subject 1).

### 6. Command vocabulary vs. the existing spec names

**Status:** open

[property-accessor](../spec/todo/2330-property-accessor.md) already names
commands: `at`, `at_call`, `instance_property`, `instance_method_call`,
`own_property`. This proposal's `at` = its `at`; `bindCall` = its
`at_call`.

Options:

1. Adopt the existing names in the AST.
2. AST keeps only the general layer (`at`, `bindCall`); 2330's
   `instance_property` / `instance_method_call` are noted as compile-time
   specializations of the VM's internal bytecode, not AST-level
   distinctions.

Leaning toward 2 (minimal AST; bytecode is where performance distinctions
live per [serialization](../spec/todo/serialization.md)). Consequence: the
AST interpreter carries the safety burden 2330 assigns to compile-time
checks — `["at", obj, "constructor"]`, `__proto__`, and other prohibited
names must be rejected at *runtime*.

### 7. Top-level shape of a function

**Status:** open

A function body is a *bare* array of operation nodes: array means "anchor
list" at body position and "tagged tuple" at operand position.
Intentional, but must be stated explicitly; it also matches the eventual
`["function", body]` node.

To decide: whether stage 1's `Function` constructor input is the bare
anchor list or a wrapper carrying metadata — parameter count for
`.length`, and parameter-shape fidelity for `toString(f)` (subject 2
erases names and arity; without a wrapper, `toString` can only print a
rest-parameter spelling).

### 8. Anchored, JS-deterministic evaluation

**Status:** decided

**Resolution: every operation that may throw must be linked into the
graph, and the anchor list is the syntax that links it.**

- A throw is an effect. A reference edge can only express "the result is
  needed here"; a may-throw operation needs "evaluate this, at this point
  in the order, even if its value is never (or not yet) needed". A pure
  data-flow DAG has no edge type for that, so the format needs dedicated
  syntax: the body's anchor list — an n-ary `seq`, the function's effect
  chain, mirroring source statement order. (Graph IRs solve this the same
  way: control/effect edges alongside data edges.) The source language
  needs no new syntax — the `const` statement *is* it.
- **All source consts are anchored, not only may-throw ones.** Anchoring
  only throwing operations would require effect analysis (`at`, `call`,
  `bindCall` throw; calls throw transitively), and the AST's shape would
  then depend on that analysis's precision — poisoning hash stability
  across compiler versions. Anchoring everything needs zero analysis and
  mirrors the source exactly.
- Consequence: evaluation is **fully JS-eager-deterministic** — anchor
  entries in source order, anonymous operands depth-first left-to-right
  (JS's own expression order), every throwing operation fires exactly when
  JS would fire it. Spec principle 2 ([spec/README.md](../spec/README.md))
  holds outright; no stance on error identity or timing is needed.
- Memoization by node identity is well-defined under this order: a shared
  node evaluates at its first demand (for compiler output, its anchor
  position) and is reused afterwards.
- Future: a branch operand carries its own nested anchor list, giving each
  branch its per-branch effect order (subject 3).

### 9. Canonical graph serialization and hashing

**Status:** open

Sharing is semantic (subject 1), so the canonical byte form must encode
the **graph**, not a tree expansion:

- deterministic CBOR needs sharing support (RFC 8949 tags 28/29 or a
  profile-defined equivalent) with a canonical placement rule — e.g.
  first use in evaluation order is the definition, later uses are
  back-references. The back-reference indices are **derived** from the
  graph, never authored (subject 1). Affects the CBOR task in
  [mvp-roadmap](../../nanvm-lib/todo/mvp-roadmap.md).
- Hash-consing / content-addressed dedup must **not** merge structurally
  identical constructor nodes: `[{}, {}]` and `const x = {}; [x, x]` are
  semantically different, and a naive structural hash conflates them. The
  hash must be computed over the canonical graph serialization.
- JSON output expands sharing ([spec/README.md](../spec/README.md)) and is
  therefore not a valid AST carrier; DJS and tagged CBOR are.
- Open corner for stage 2: nested functions plus cross-function shared
  nodes make context-dependent references (`["args"]`, and any
  binder-relative form) hard to hash structurally — a known difficulty of
  binders + sharing. Constraint to resolve when the `function` node is
  designed.
