# AST stage 1: discussion

**Priority:** P2
**Status:** open — working document for designing the stage 1 function AST.
Each subject below is resolved separately; once all are **decided**, the
result is distilled into a concrete design in [ast-spec.md](./ast-spec.md)
and this document is deleted.

## Baseline: a computation DAG with anchored evaluation

*This baseline supersedes the original index-based sequence proposal; the
revision history is recorded in subjects 1 and 8.*

A function body is a **single operation node** — the root of the
computation DAG. Non-resulting computations (asserts — fail-fast
guards, A4) are merged into the graph by the **`comma` operation**:

- `["comma", ...asserts, result]` establishes **all** of its operands
  (subject 8) and takes the value of the **last** one — it *is* the JS
  comma operator, `(a, b) → b`. The assert operands' values are
  discarded — they exist for their throw-potential only — and are
  unordered among themselves (A4). Result-last buys source fidelity:
  the future source pattern

  ```js
  return assert(a >= 0 && b >= 0), a + b
  ```

  lowers to a `comma` node verbatim, `toString(f)` prints it back
  verbatim, and a JS engine running the printed source implements one
  legal schedule (left-to-right, eager) of the same semantics. The
  statement spellings normalize to the same node — all three of

  ```js
  const f = a => { assert(a >= 0); return a + 2 }
  const g = a => { const _ = assert(a >= 0); return a + 2 }
  const h = a => { return assert(a >= 0), a + 2 }
  const k = a => (assert(a >= 0), a + 2)
  ```

  are one function with one AST and one hash. The last spelling — an
  expression-bodied arrow, no block, no `return` — is the most compact
  and the natural form for `toString(f)` to print. The AST has **no assert
  node**: `assert` is an ordinary function value that throws on a falsy
  argument; what makes an operand an assert is purely positional — its
  value is discarded by `comma`.
  [operators](../spec/todo/2340-operators.md) allows the comma operator
  for exactly this reason: it was rejected as "useful only when we want
  to mutate", and the assert pattern is the counter-example — in a pure
  language the only side effect a discarded operand can have is
  throwing.
- The operands of a `comma` are this document's **branches**: rooted
  subgraphs of the DAG, sharing nodes freely by reference — distinct
  from the control-flow branches of the future `cond` (subject 3).
- **Stage 1 ships without `comma`**: a stage 1 body is a plain node, and
  the operation is introduced later, when asserts arrive, without
  changing the body's shape.

- an operation node is:
  - a **non-object, non-array value** — a constant: `"hello world"`, `2.5`,
    `false`, `undefined`, `null`, `34n`;
  - an **object** — an object constructor; each property value is an
    operation node;
  - an **array** — a tagged tuple `[tag, ...operands]`; the tags are
    listed in [Operations](#operations) below.
- operand positions hold **real references** to nodes, not indices.
  Referencing the same node from two positions is **semantic sharing**: the
  node is evaluated once and its result reused. `const x = {}` then
  `[x, x]` yields an array with `a[0] === a[1]`, while `[{}, {}]` yields
  two distinct objects.
- evaluation: the root node is established (subject 8) and its value is
  the function's result; a `comma` establishes all its operands, in any
  order, possibly in parallel (A4); every node is memoized by its
  identity, so shared nodes evaluate once.

The graph cannot be serialized as JSON (sharing would be lost — and
sharing is semantic), but it serializes as **DJS** (`const` + reference):
the AST's sharing structure and DJS's graph structure are the same thing.

```js
// const f = (...a) => { const x = a[0]; return [x, x] }
const x = ["at", ["args"], 0]
export default ["array", x, x]       // the body is one node; x is interior

// (...a) => { const check = a[0].length; return a[1] } — with comma (later)
const a = ["args"]
export default ["comma",
    ["at", ["at", a, 0], "length"],  // assert: value unused
    ["at", a, 1],                    // the result: last, as in JS (a, b) → b
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

## Operations

The operations we want, with their stage. Every operand is an operation
node; `node` below means any of them.

### Structural operations

|Form|JS|Stage|Notes|
|----|--|-----|-----|
|`2.5`, `"a"`, `true`, `null`, `undefined`, `34n`|itself|1|constant — any non-object, non-array value|
|`{ key: node, … }`|`{ key: … }`|1|object constructor; key order is part of the value (subject 4)|
|`["array", ...node]`|`[…]`|1|array constructor|
|`["args"]`|—|1|the arguments array (subject 2)|
|`["at", node, node]`|`o[i]`|1|subject 6|
|`["call", node, node]`|`f(...args)`|1|the second operand yields the argument array|
|`["bindCall", node, node, node]`|`o[p](...args)`|1|keeps `this` binding; subject 6|
|`["comma", ...node, node]`|`(a, b)`|later|membership without order (subject 8)|
|`["function", …]`|`(…) => …`|later|closures; shape open (subject 7)|

### Operators

Operators are tagged by their **actual JS symbol**, not by a name:
`["+", a, b]`, not `["add", a, b]`. This is
[DESIGN.md §8](../DESIGN.md) again — the host language already spells
these, so the AST reuses the spelling instead of inventing a vocabulary
to be memorized and translated. Symbol tags never collide with the word
tags above, so both live in one namespace.

**Arity distinguishes unary from binary**: `["-", a]` is negation and
`["-", a, b]` is subtraction — the same overloading JS itself uses, and
unambiguous because no JS operator has two different meanings at the
same arity.

|Symbols|Arity|JS|Lazy|Notes|
|-------|-----|--|----|-----|
|`+` `-`|1|`+a`, `-a`|no|`+` is also the coercion [property-accessor](../spec/todo/2330-property-accessor.md) requires before a run-time index|
|`!` `~`|1|`!a`, `~a`|no|unary only|
|`+` `-` `*` `/` `%` `**`|2|`a + b`|no|arithmetic|
|`===` `!==` `<` `<=` `>` `>=`|2|`a === b`|no|`==` and `!=` are not allowed by [operators](../spec/todo/2340-operators.md)|
|`&` `\|` `^` `<<` `>>` `>>>`|2|`a & b`|no|bitwise|
|`&&` `\|\|` `??`|2|`a && b`|**yes**|the right operand is established only if the left does not decide the result|
|`?:`|3|`c ? t : e`|**yes**|exactly one of the two arms is established|

All operators are post-stage-1: stage 1 has no operators at all.

**Laziness is positional, not nodal.** A lazy operand is a node that may
never be demanded — but the same node referenced from an eager position
elsewhere is still evaluated there, once, by memoization. Short-circuit
operators are therefore the one exception to subject 8's "all operands
are established": for `&&`, `||`, `??`, `?:` the operand set is
*conditional*, exactly as in JS — which is what keeps A3 exact, since JS
does not evaluate those operands either.

**`?:` is the branch node.** The hypothetical `["cond", …]` of subject 3
is not needed: the ternary operator is that node, spelled as JS spells
it.

**Throwing is the only effect.** In a purely functional language (A1)
the sole side effect an eager computation can have is *throwing* — with
non-termination and resource exhaustion collapsed into the same opaque
failure (A2, A4). Everything else about a node is just its value.
Consequences:

- the whole membership apparatus — `comma`, subject 8, effect edges —
  exists for this one effect. Were nothing able to throw, the AST would
  be pure data flow: unreachable nodes could simply be dropped;
- eager and lazy evaluation of an operand differ *only* in whether a
  failure can be introduced. So the ban on **speculating** a lazy
  operand (A4) is narrower than stated there: an operand **proven
  non-throwing may be speculated**, hoisted, or evaluated in parallel —
  the same as-if reasoning that lets a proof stand in for running a
  guard (subject 8);
- "may throw" is therefore the single predicate an optimizer needs.
  Nodes proven total are freely movable and droppable — but **not
  freely duplicable**: an object or array constructor creates observable
  identity even though it cannot throw (subject 1).

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
(A2). Hence all evaluation orders of independent anchored branches are
observably equal.

Unlocked by rejecting A4:

- reordering and parallel evaluation of independent anchored branches;
  canonical ordering for hash matching (subject 1 note);
- **fail-fast guards**: an anchored branch whose value the result never
  uses (an assert, a range check) is pure throw-potential — an engine
  may execute such branches as soon as possible, e.g. hoisted into a
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

- **dropping** an anchored may-throw operation — A3 makes the `comma`
  merge an existence guarantee (subject 8);
- **speculating** a lazy operand — a not-taken branch may throw where JS
  completes; unless it is *proven* non-throwing, in which case
  speculation is unobservable and allowed (see "Throwing is the only
  effect" in [Operations](#operations));
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
  node that other nodes reference — or an assert-branch root when its
  value is unused. Sharing cannot be inlined away (it is
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
const f = (...a) => a[5]   // ["at", ["args"], 5]
const g = (a) => a[5]      // ["at", ["at", ["args"], 0], 5]
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
- Recorded extension path: the lazy operators themselves —
  `["&&", a, b]`, `["||", a, b]`, `["??", a, b]`, `["?:", c, t, e]` (see
  [Operations](#operations)) — where laziness is a property of the
  operand *position*. No separate `cond` node is needed: `?:` is the
  branch node. A branch operand is an ordinary node — including a
  `comma` node when the branch has its own guards, which gives each
  control branch its per-branch effect membership with no extra
  machinery (subject 8).
- The reference model dissolves the scoping problem that the index model
  had: there is no index space to scope, no De Bruijn `(up, index)`
  machinery; sharing across a lazy boundary is a plain reference, and a
  node demanded from two branches evaluates at most once (memoization).
- Deferred to stage 2 (`function` node): nested functions make `["args"]`
  context-dependent (whose arguments?) — see the open corner in subject 9.

### 4. Object constructor: key order and duplicate keys

**Status:** decided

**Resolution: property order is semantic** — the written key order is
part of the constructed *value*, not of the schedule: JS objects
preserve insertion order (`Object.keys`, iteration, `JSON.stringify`),
so reordering an object constructor's keys changes the resulting
object. This holds with A4 rejected — the evaluation *order* of
property operands is as free as any other (subject 8); what is fixed is
the result. Sorted-key canonicalization (as `fjs compile` applies to
data output, [spec/README.md](../spec/README.md)) must **not** be
applied to object constructors. Duplicate keys are a validation error.

### 5. Validation

**Status:** open (list agreed in direction, details when the RTTI schema
is written)

The AST is the `Function` constructor's public input and will see shapes
the FJS compiler would never emit. To validate:

- constants: function values in constant position are a validation error
  (until a `["function", ...]` node exists,
  [function](../spec/todo/3110-function.md));
- the body: a single operation node;
- `comma` (when introduced): at least two operands — a single-operand
  `comma` is the identity and non-canonical; an assert operand reachable
  from another operand of the same `comma` is redundant (well-formedness,
  subject 8);
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

Related, now that operators are tagged by symbol
([Operations](#operations)): should the structural tags be symbolic too
— `["[]", o, i]` for `at`, something for `call`? Leaning no: `o[i]` and
`f(...args)` are *syntax*, not operator symbols, so there is nothing to
reuse; a word tag is the honest spelling. Worth deciding together with
the names above so the vocabulary is settled in one pass.

### 7. Top-level shape of a function

**Status:** open

With the body a single operation node, no special top-level shape
remains — every position, the body included, is a node, and the body
composes directly into the eventual `["function", body]` node.

To decide: whether stage 1's `Function` constructor input is the bare
body node or a wrapper carrying metadata — parameter count for
`.length`, and parameter-shape fidelity for `toString(f)` (subject 2
erases names and arity; without a wrapper, `toString` can only print a
rest-parameter spelling).

### 8. `comma`: anchored evaluation

**Status:** decided (revised: the merge is the `comma` operation)

**Resolution: non-resulting computations are merged into the graph by
the `comma` operation — `["comma", ...asserts, result]`, the JS comma
operator — which guarantees *membership*, not order.** Stage 1 ships
without `comma`; these rules bind the operation when it is introduced.

- A throw is an effect. A reference edge can only express "the result is
  needed here"; a may-throw operation needs "evaluate this even if its
  value is never needed". A pure data-flow DAG has no edge type for
  that, so the format needs dedicated syntax: `comma`'s assert-operand
  positions are exactly those effect edges. (Graph IRs solve this the
  same way: effect edges alongside data edges.) Being an ordinary
  operation, `comma` composes anywhere in the graph — body root, or
  inside a future control branch — one mechanism for all scopes.
- **Only true roots need merging.** A source const whose value the
  result uses is already a member by reachability — it collapses into
  an interior shared node. Only non-resulting roots — the asserts —
  need a `comma` operand; at the source level, an unused `const` *is*
  the assert syntax. Identifying roots is **reachability, not effect
  analysis**: the AST's shape does not depend on any analysis's
  precision, preserving hash stability across compiler versions.
- **Well-formedness: merged operands are true roots** — an assert
  operand must not be reachable from any other operand of the same
  `comma`. Without this rule the same function could be spelled with or
  without redundant merged-but-referenced operands, needlessly
  splitting hashes. A single-operand `comma` is the identity and
  equally non-canonical.
- **Branch ordering: the spec owns the spelling; engines own the
  schedule.** What matters for the specification is **canonical order**:
  the result operand at its fixed last position (the JS comma reading),
  and (eventually) a canonical order for the asserts before it — the
  leading candidate is
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
- **Membership is never negotiable: a `comma`'s value is revealed only
  after ALL its operands complete successfully.** Scheduling freedom is
  about *when* guards run, never *whether*. When the guarded `comma` is
  the body root, its value is the function's value — so nothing escapes
  to the caller until every guard passes. This is more than A3 fidelity
  — an assert may be a security guard whose failure must prevent the
  result from ever reaching the caller:

  ```js
  const getValue = key => { assert(key !== 'password'); return map[key] }
  ```

  An engine may compute anything early — even the result operand
  speculatively, which is unobservable — but the `comma`'s value must
  not be revealed until every assert operand has succeeded.

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

- **Asserts are contracts, not validation.** A developer must never use
  asserts to validate untrusted input — a function handling an HTTP
  request must not guard the request with asserts, or any user can crash
  the program (a DoS vector). Untrusted-input validation is an ordinary,
  *expected* outcome and belongs in values (`Result` / `Nullable`,
  [044-error-handling-pattern](./044-error-handling-pattern.md)); an
  assert firing means the program itself is wrong — a breach of an
  internal API contract. The opaque-error contract (A4) enforces this
  discipline by construction: an error carries no information, so an
  assert *cannot* tell a caller what was wrong with their input —
  validation that needs to explain itself must produce a value.

  Asserts and throws are fully at home in **tests**. A test framework is
  a host, not FS code — it sits on the out-of-band side of the A4
  contract, where diagnostics already flow — so it may reveal everything
  about a triggered assert (which one, where, with what context) to the
  human. Contract breaches are precisely what tests exist to detect.

  An engine that actually *skips* assert branches is conceivable only as
  a **debug mode** — a development tool showing the would-be result even
  when guards would fail. Such a mode is non-conforming by definition:
  never a default, and its results must never enter the
  content-addressed cache or otherwise escape the debugging session —
  they are not the function's outcome.
- **Membership is semantic; order is not** (A4 rejected): every merged
  operand is established before the merging `comma`'s value is revealed,
  so A3's always-fails holds — but any evaluation order of branches
  (including parallel, and asserts as fail-fast guards before the data
  path) is legal under the opaque-error contract. Data dependencies
  still order evaluation; lazy operands (subject 3) are still never
  speculated.
- Memoization by node identity: a shared node evaluates once, at its
  first demand.
- Future: a control-flow branch operand (`cond`, subject 3) carries its
  guards as a `comma` node inside the branch — per-branch effect
  membership with no extra machinery.

### 9. Canonical graph serialization and hashing

**Status:** parked — deliberately deferred; not part of the stage 1
discussion. The notes below are kept so nothing is rediscovered later.

Sharing is semantic (subject 1), so the canonical byte form must encode
the **graph**, not a tree expansion:

- deterministic CBOR needs sharing support (the IANA-registered
  value-sharing tags 28/29, or a profile-defined equivalent) with a
  canonical placement rule — e.g. first use in evaluation order is the
  definition, later uses are back-references. The back-reference indices
  are **derived** from the graph, never authored (subject 1). Affects
  the CBOR task in [mvp-roadmap](../nanvm-lib/todo/mvp-roadmap.md).
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
