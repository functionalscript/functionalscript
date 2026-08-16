# AST stage 1: discussion

**Status:** open — working document for designing the stage 1 function AST.
Each subject below is resolved separately; once all are **decided**, the
result is distilled into a concrete design in [ast-spec.md](./ast-spec.md)
and this document is deleted.

## Baseline: a computation DAG with anchored evaluation

*This baseline supersedes the original index-based sequence proposal; the
revision history is recorded in subjects 1 and 8.*

A function body is an **array of branches**: every entry is the root
node of a rooted subgraph of the computation DAG. The **first** entry is
the **resulting branch**, whose value the function returns; all
remaining entries are **assert branches** — their values are discarded,
they exist for their throw-potential only (fail-fast guards, A4). The
spelling is *fixed head + unordered tail*: index 0 is always the result
(stable under adding or removing asserts, knowable without the array's
length, and rhyming with the head-first tagged tuples), while the assert
branches are unordered among themselves. Branches share nodes freely by
reference, and all must complete for the function to complete normally.
(These are DAG branches — rooted subgraphs — not the control-flow
branches of the future `cond`, subject 3.)

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
- evaluation: every branch evaluates (in any order, possibly in
  parallel — A4); every node is memoized by its identity, so shared
  nodes evaluate once; the function's value is the resulting branch's
  value.

The graph cannot be serialized as JSON (sharing would be lost — and
sharing is semantic), but it serializes as **DJS** (`const` + reference):
the AST's sharing structure and DJS's graph structure are the same thing.

```js
// const f = (...a) => { const x = a[0]; return [x, x] }
const x = ["at", ["args"], 0]
export default [["array", x, x]]     // one branch: the result; x is interior

// (...a) => { const check = a[0].length; return a[1] }
const a = ["args"]
export default [
    ["at", a, 1],                    // resulting branch: always first
    ["at", ["at", a, 0], "length"],  // assert branch: value unused
]
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

## Assumptions

Different graph-building rules follow from which of these assumptions are
accepted or rejected. Enumerated first, analyzed separately; each ends as
**accepted** or **rejected**, and the graph-building rules in the subjects
are then derived from the accepted set.

### A1. No side effects

**Status:** accepted

Code and functions don't have side effects: executing the same function
with the same parameters always produces the same result. This is FS
principle 1 ([spec/README.md](../spec/README.md)); with A2, "same result"
applies to runs that complete.

### A2. The runner may interrupt

**Status:** accepted

A runner has the right to interrupt a function if it consumes too many
resources or takes too much time to compute. No specific memory or time
limits are part of the specification.

Resource limits are a property of the **engine**, not of the function:
where one engine interrupts, another engine with more resources may
return a result or throw the semantics-mandated exception (A3). The
semantics defines one ideal outcome per input; every engine is a partial
realization of it. Engines may differ in *whether* they answer; for
*what* they answer, agreement is tiered:

- **Content-addressable engines (CAVM) with the same version of function
  serialization and identities MUST return the same result** — across
  engines and across runs (A1 gives this within one engine).
- Results of non-CA engines may vary in some cases: the observations
  that touch identity or function serialization (object/function
  identity, identity-based ordering —
  [object-identity](../spec/todo/object-identity.md) — and
  `toString(f)` text), which non-CA engines realize by references and
  run history rather than by content. The exact list of such cases is to
  be enumerated; identity-free observations agree on all engines.

Consequently FS code cannot rely on interruption or on its absence, and
an interrupt is observably the same opaque failure as any other (A4
contract).

### A3. Throws are preserved

**Status:** accepted

If a function **always** throws in JavaScript for the same parameters,
it must also **always** throw (fail) in FunctionalScript with the same
parameters.

"Always" scopes both sides to determinism-by-semantics: covered are the
throws the language mandates (e.g. `null[0]` fails on every run);
excluded are engine-dependent failures (stack-overflow depth,
out-of-memory), which ECMAScript does not pin down — those fall under
A2's interrupt freedom instead. Together with FS principle 2: when JS
always completes with a value, an uninterrupted FS run completes with
that value — so for spec-deterministic behavior, FS fails iff JS throws
or the runner interrupts (A2).

### A4. Computation order is preserved

**Status:** rejected — replaced by the opaque-error contract

Preserving observable computation order would forbid rearranging the
graph (for canonical hashing) and most optimization. Rejection is sound
only given A1 and only under the following contract.

**Opaque-error contract.** For every input, a function's observable
outcome is either its JS value or one indistinguishable "unexpected
error":

- an error carries no information out of a function — no error values,
  types, or messages cross the function boundary (`throw password`
  cannot leak; errors are not an exfiltration channel). Example of why,
  interlocking with unordered branches:

  ```js
  const f = user => {
      assert(authorizedUser(user))
      // ... deep in the data path:
      throw `invalid-api-key: ${apiKey}`
  }
  ```

  With branches unordered, an engine may evaluate the data path before
  the authorization guard — a race that would hand an unauthorized
  caller the API key if throw payloads were observable. Opaque errors
  make the race harmless: whichever throw fires first, the caller sees
  the same information-free failure. Opaque errors are not only what
  *permits* rejecting A4 — they are what makes unordered guards *safe*
  in the presence of secret-carrying throws;
- FS code cannot catch or inspect errors — stage 1 has no catch, and
  failures propagate to the host. A future catch/Result facility
  observes failure only at region granularity, and reordering must then
  respect region boundaries;
- a runner interrupt (A2) is observably the same "unexpected error":
  aborts, JS-mandated throws, and non-termination all collapse into one
  failure outcome;
- runners may emit out-of-band diagnostics (which operation failed, and
  where) for humans; FS code can never read them.

Soundness: by A1 the completed value is order-independent; by A3 plus
anchoring (subject 8) every may-throw operation still evaluates under
any reordering, so fails-vs-completes is order-independent; reordering a
throw behind a non-terminating computation yields failure either way
(A2). Hence all evaluation orders of independent anchored entries are
observably equal.

Unlocked by rejecting A4:

- reordering and parallel evaluation of independent anchored entries;
  canonical ordering for hash matching (subject 1 note);
- **fail-fast guards**: an anchored entry whose value the result never
  uses (an assert, a range check) is pure throw-potential — an engine
  may execute such entries as soon as possible, e.g. hoisted into a
  prologue before expensive data-path work, or in parallel with it.
  Failing early also wastes fewer resources (A2), and an AOT backend can
  compile the guards into a literal precondition prologue;
- **resource-aware orchestration**: branches are schedulable units, so a
  smart orchestrator may put a branch on hold when it demands too many
  resources (e.g. allocates heavily) — a hold is unobservable since no
  order is. Combined with fail-fast, the orchestrator parks the
  expensive branch, races the cheap asserts, and either saves the parked
  work (an assert fails) or resumes it (all pass) — making interruption
  (A2) the last resort rather than the only tool.

Still illegal with A4 rejected:

- **dropping** an anchored may-throw operation — A3 makes the branch
  array an existence guarantee (subject 8);
- **speculating** a lazy operand — a not-taken branch may throw where JS
  completes;
- **merging** identical constructor nodes — object identity is
  observable and sharing stays semantic (subject 1).

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
  is an anonymous nested operand; a source `const` is a shared interior
  node — or an assert-branch root when its value is unused
  that other nodes reference. Sharing cannot be inlined away (it is
  observable: `{} === {}` is `false`), and reordering is constrained by
  throw order (subject 8) — so neither "maximally flat" nor "maximally
  nested" is a valid normal form. Hash identity = structural identity of
  the graph as written (the name-erased source); hash equality does not
  decide semantic equivalence (same stance as Unison).
  *Note (A4 rejected):* the throw-order half of this rationale is
  superseded — under the opaque-error contract, canonical reordering and
  inlining are *sound* modulo sharing, so a normal form is now possible
  in principle. Whether to adopt one is parked with subject 9 (its
  motivation is hash matching); stage 1 keeps hash-as-written.
- **Lowering is one-way and lossy.** Lifetime and slot management — `pop`,
  top-relative indexing, auto-consuming RPN stack schemes — belong to the
  VM-internal bytecode
  ([vm-command-format](../spec/todo/vm-command-format.md),
  [call-like-instructions](../spec/todo/9100-call-like-instructions.md),
  [function-frame](../spec/todo/3111-function-frame.md)), whose generator
  does liveness analysis. Restoring the AST from bytecode is neither
  required nor generally possible: the function always carries its AST.
- **The AST is the single input to multiple processors**: the bytecode
  interpreter, the `toString(f)` source printer (shared nodes print as
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
  nested branch array carrying that branch's effect membership
  (subject 8).
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
- the body: must be a non-empty array — the resulting branch (index 0)
  must exist;
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

A function body is a *bare* array of operation nodes: array means
"branch array" at body position and "tagged tuple" at operand position.
Intentional, but must be stated explicitly; it also matches the eventual
`["function", body]` node.

To decide: whether stage 1's `Function` constructor input is the bare
branch array or a wrapper carrying metadata — parameter count for
`.length`, and parameter-shape fidelity for `toString(f)` (subject 2
erases names and arity; without a wrapper, `toString` can only print a
rest-parameter spelling).

### 8. Branches: anchored evaluation

**Status:** decided (revised under A4 rejected)

**Resolution: a function is an array of branches — assert branches plus
the resulting branch — and the array guarantees *membership*, not
order.**

- A throw is an effect. A reference edge can only express "the result is
  needed here"; a may-throw operation needs "evaluate this even if its
  value is never needed". A pure data-flow DAG has no edge type for
  that, so the format needs dedicated syntax: the branch array. (Graph
  IRs solve this the same way: effect edges alongside data edges.)
- **Entries are the roots of the DAG, and only the roots.** A source
  const whose value the result uses is already a member by reachability
  — it collapses into an interior shared node and needs no entry. Only
  non-resulting roots — the assert branches — need listing; at the
  source level, an unused `const` *is* the assert syntax. Identifying
  roots is **reachability, not effect analysis**: the AST's shape does
  not depend on any analysis's precision, preserving hash stability
  across compiler versions.
- **Well-formedness: entries are true roots** — an assert entry must
  not be reachable from any other entry. Without this rule the same
  function could be spelled with or without redundant
  listed-but-referenced entries, needlessly splitting hashes.
- **Branch ordering: the spec owns the spelling; engines own the
  schedule.** What matters for the specification is **canonical order**:
  the resulting branch at its fixed head, and (eventually) a canonical
  order for the assert tail — the leading candidate is
  **lexicographical content-hash order**, which gives the function a
  stable hash regardless of how the source ordered its asserts, with the
  hash as its own total order and tie-breaker (details ride on the
  canonical graph serialization, subject 9). Not for the first
  implementation.
  How engines *prioritize* branches is deliberately unspecified — order
  is not semantic, so any schedule is legal: racing cheap guards first
  (fail-fast), parking expensive branches, full parallelism, or plain
  sequential. A `throw` in FS is the analogue of a panic in other
  languages, so engines may reasonably assume asserts rarely fire and
  optimize for the happy path. The spec assumes nothing about any of
  this; the freedoms above are illustrations of what A1–A4 make sound
  for any engine, with no coordination.
- **Membership is never negotiable: a result is revealed only after ALL
  branches complete successfully.** Scheduling freedom is about *when*
  guards run, never *whether*. This is more than A3 fidelity — an assert
  branch may be a security guard whose failure must prevent the result
  from ever reaching the caller:

  ```js
  const getValue = key => { assert(key !== 'password'); return map[key] }
  ```

  An engine may compute anything early — even the resulting branch
  speculatively, which is unobservable — but the function's value must
  not escape to the caller until every assert branch has succeeded.

  "Succeeded" is an **as-if** rule — the engine must *establish* each
  branch's success, not necessarily *execute* it:
  - **proof instead of execution**: a guard proven never to throw
    (types, value analysis) is established without running — A4's
    unobservability makes proof and execution indistinguishable;
  - **cache instead of execution**: by A1 any outcome is a pure function
    of content and inputs, so a content-addressed cache hit *is* the
    computation — CAVM's premise: hash of (function, arguments) →
    result. Only *semantic* outcomes are cacheable — a value, or a
    mandated failure (A3); an A2 interrupt is an engine artifact, never
    a cacheable verdict.

  An engine that actually *skips* assert branches is conceivable only as
  a **debug mode** — a development tool showing the would-be result even
  when guards would fail. Such a mode is non-conforming by definition:
  never a default, and its results must never enter the
  content-addressed cache or otherwise escape the debugging session —
  they are not the function's outcome.
- **Membership is semantic; order is not** (A4 rejected): every branch
  evaluates before the function completes normally, so A3's
  always-fails holds — but any evaluation order of branches (including
  parallel, and assert branches as fail-fast guards before the data
  path) is legal under the opaque-error contract. Data dependencies
  still order evaluation; lazy operands (subject 3) are still never
  speculated.
- Memoization by node identity: a shared node evaluates once, at its
  first demand.
- Future: a control-flow branch operand (`cond`, subject 3) carries its
  own nested branch array, giving each control branch its per-branch
  effect membership.

### 9. Canonical graph serialization and hashing

**Status:** parked — deliberately deferred; not part of the stage 1
discussion. The notes below are kept so nothing is rediscovered later.

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
