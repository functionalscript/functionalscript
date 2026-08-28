## reuse-edag-operators. Reuse the canonical EDAG operator format in NaNVM

**Priority:** P3
**Status:** open

### Problem

`fjs/nanvm/` has a shared operator corpus consumed by both the JavaScript proof
([`proof.f.mjs`](../proof.f.mjs)) and the Rust test generator
([`rust/module.f.mjs`](../rust/module.f.mjs)). Today it identifies operations
with a NaNVM-specific vocabulary:

```ts
export type Op = 'unaryPlus' | 'unaryMinus' | 'mul' | 'stringCoercion'
```

and types `Case.args` as `readonly Value[]`, so nothing connects an operation to
its operand count — a unary operation given two arguments is not a type error.

The canonical vocabulary this should reuse now exists. [`fjs/edag/`](../../edag/README.md)
is the EDAG data model of record: the RTTI schema in
[`module.f.mjs`](../../edag/module.f.mjs) exports the operation-id vocabularies
`op1Id` (`String` `Number` `neg` `!` `~`) and
`op2Id` (`=>` `own` `===` `!==` `>` `>=` `<` `<=` `+` `-` `*` `/` `%` `**`
`&` `|` `^` `<<` `>>` `>>>` `&&` `||` `??`), and
[`types.ts`](../../edag/types.ts) carries the same ids at the type level
(`Op1Id`, `Op2Id`) with the node shapes `Op1 = readonly[Op1Id, Exp]` and
`Op2 = readonly[Op2Id, Exp, Exp]`, pinned against the schema with
`Assert<Check<...>>` so the two cannot drift. Operations are grouped by
`exp`-operand count — `op0`/`op1`/`op2` — so an operation's arity is not an
annotation: it is which group its tag belongs to. Every tag is unique across
the groups (negation is the word tag `neg`, never an arity-overloaded `-` —
see the "Operators" section of
[`edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md)), so
deriving operand shape from a tag lookup is unambiguous.

An earlier revision of this todo was blocked on that vocabulary existing.
It does now, and nothing below needs the DJS compiler
([compile-modules-to-edag](../../djs/todo/compile-modules-to-edag.md)): the
corpus imports the schema and the types directly, along the same one-way
dependency every EDAG consumer uses.

Every operation the corpus tests today maps onto that vocabulary:

| corpus `Op` today | canonical EDAG operation | group |
|---|---|---|
| `unaryMinus` | `['neg', exp]` | `op1` |
| `mul` | `['*', exp, exp]` | `op2` |
| `stringCoercion` | `['String', exp]` | `op1` — a canonical id now, no longer a NaNVM-only name |
| `unaryPlus` | none | the EDAG has no unary `+`; the group becomes `['Number', exp]` via [replace-unary-plus-with-number](../../../nanvm-lib/todo/replace-unary-plus-with-number.md) — a semantic change (`Number(0n)` does not throw where `+0n` does), tracked there, not a rename here |
| the `eq` section | `['===', exp, exp]` | `op2` — see [`eq` and node sharing](#eq-and-node-sharing) |

NaNVM must not keep a second semantic operator format that can drift from this.
If EDAG changes an operator spelling, operand shape, or validation rule, the
corpus consumes the change through the shared definition — through a failing
`npx tsc` or a failing proof, never through a parallel edit staying in sync by
discipline.

### Proposal

Make `fjs/edag/` the single source of truth for operator identity and operand
contract in the corpus, in three steps: the corpus **types** reuse the EDAG id
vocabularies; each **case** derives a real EDAG expression, validated against
the schema; the **consumers** converge on evaluating that expression, until the
corpus doubles as the shared EDAG conformance vectors.

This does **not** turn the corpus into an EDAG program. The corpus still owns
everything test-only:

- case names used as stable proof/test diagnostics;
- concrete input values and expected values (`expected` describes the test's
  outcome, not the program under test — it stays a `Value` compared with
  `Object.is`);
- `throws`, `ref`, `functionValue`, and other test-only markers;
- `rust` gap/reason metadata;
- commutative-case expansion and the `Swapped` name convention.

Only the semantic operation identity and operand contract come from EDAG.

#### Step 1 — the types reuse the EDAG vocabulary

Replace the local `Op` union with the imported ids, and split `Group` by the
same operand-count rule the schema itself uses:

```ts
import type { Op1Id, Op2Id } from '../edag/types.ts'
import type { Tuple } from '../types/array/types.ts'

export type Case<N extends number> = {
    readonly name: string
    readonly args: Tuple<N, Value>
    readonly expected: Value
    readonly rust?: string
}

export type Group1 = {
    readonly op: Op1Id
    readonly cases: readonly Case<1>[]
}

export type Group2 = {
    readonly op: Op2Id
    readonly commutative?: boolean
    readonly cases: readonly Case<2>[]
}

/**
 * The visible exception: an operation with no canonical EDAG id yet. The
 * field is deliberately not `op`, so a NaNVM-only name can never mix into
 * the canonical id unions. Today its one inhabitant is `unaryPlus`; the
 * type is deleted when
 * [replace-unary-plus-with-number](../../../nanvm-lib/todo/replace-unary-plus-with-number.md)
 * moves that group to `Number`.
 */
export type NonEdagGroup = {
    readonly nanvmOp: 'unaryPlus'
    readonly cases: readonly Case<1>[]
}

export type Group = Group1 | Group2 | NonEdagGroup
```

- The arity is derived from which vocabulary the group's `op` belongs to —
  `Op1Id` groups carry `Case<1>`, `Op2Id` groups `Case<2>` — mirroring
  `op1`/`op2` instead of annotating an `argsN` next to the tag. Wrong operand
  counts are rejected statically; add type-level proofs of that.
- `commutative` exists only on `Group2`, so it is binary-only by construction.
- The coupling proof comes free: the corpus data spells ids as literals
  (`op: '*'`), so removing or respelling an id in `fjs/edag/types.ts` fails
  `npx tsc` in the corpus instead of silently leaving it stale.
- The group order in `data.groups` and the generated Rust function names are
  consumer concerns and stay stable: the Rust printer owns an explicit
  `Op1Id | Op2Id -> Rust identifier` map (`'*'` → `mul`, `'neg'` → `neg`,
  `'String'` → `string_coercion`, …). It must never derive an identifier by
  `snakeCase` over a punctuation tag, and Rust names never leak back into the
  shared data.

#### Step 2 — a case is an EDAG expression

Each case, joined with its group's id, denotes a program: apply the operation
to constant operands. Say so literally — derive an EDAG `Exp` per case:

```js
/** @type {(v: Value) => Exp} */
const constExp = v => {
    if (v === undefined) { return ['undefined'] }
    if (Array.isArray(v)) { return ['[]', v.map(constExp)] }
    if (typeof v === 'object' && v !== null) {
        return ['{}', entries(v).map(([k, p]) => [':', k, constExp(p)])]
    }
    return v // null, boolean, number, string, bigint: a primitive is itself
}

// a Group1 case:      [id, constExp(a)]
// a Group2 case:      [id, constExp(a), constExp(b)]
// e.g. mulCases[0]:   ['*', null, null]
```

- `ref(name)` lowers to the **same node object** for every reference. EDAG
  sharing is identity — one node referenced from several places, observable
  (`{} === {}` is `false`) — which is exactly what the corpus `shared`/`ref`
  machinery exists to express. `a: ref('emptyArray'), b: ref('emptyArray')`
  is `['===', n, n]` with one shared `n`.
- `throws` never appears in the derived expression: it describes the case's
  outcome and stays on the `expected` side. (Once `['throw', exp]` from the
  stage-1 discussion lands in the schema, it becomes useful the other way
  around — as an operand proving a lazy operator did not establish it; see
  step 3.)
- `functionValue` is the one escape. A constant function is spellable as
  `['=>', ['[]', []], body]`, but establishing `=>` drags closure construction
  into both consumers for cases that never inspect the function. So the
  derivation is per **case**, not per group: a case whose operands all lower
  derives an `Exp`; a case with a `functionValue` operand stays on the
  direct-value path, with an explicit marker in the lowering rather than a
  silent fallthrough — the consumers dispatch on the group's canonical id
  either way. This is not hypothetical: `numberCoercionCases` contains a
  `functionValue` case and feeds the EDAG-backed `neg` group, so an
  EDAG-backed group must be able to carry escaped cases until an executor
  establishes `=>` anyway.

The proof then validates every derived expression with the schema —
`validate(exp)` from `fjs/rtti/validate` over `exp` from
`fjs/edag/module.f.mjs` — before running it. That is the runtime half of the
coupling: a change to an operand shape or validation rule in the schema fails
the corpus proof. (`validate` is shape-only and not identity-aware — it
re-walks shared subgraphs — which is fine here: case trees are small, acyclic
by construction, and identity-dependent canonicality is out of scope for a
test corpus.)

#### Step 3 — one execution path

The consumers stop switching on a local op name and dispatch on the derived
EDAG node:

- **JavaScript proof** — an inline evaluator for the constant subset the
  corpus uses (primitives, `['undefined']`, `['[]', …]`, `['{}', …]`, `op1`,
  `op2`), each id mapped to the JS operator/expression it names. It must
  memoize nodes by identity within one case, as real EDAG evaluation does
  ("shared nodes evaluate once" — [`fjs/edag/`](../../edag/README.md)): a
  naive recursive walk would construct a shared `n` twice and turn
  `['===', n, n]` into `false`. When the EDAG interpreter
  ([interpret-edag](../../djs/todo/interpret-edag.md)) lands, the inline
  evaluator is replaced by it and the corpus becomes part of its test suite
  for free — the memoization contract is the same one that interpreter
  already owes.
- **Rust generator** — `valueExpr`/`call` walk the same node and print the
  `nanvm-lib` expression for each id, via the explicit map from step 1. It
  needs the identity awareness in printed form: a multiply-referenced node
  becomes one shared `let` binding reused at every reference — exactly what
  the current `eqFn` does for `shared` values — never two constructions.
- **`nanvm-lib` interpreter** — the roadmap's interpreter executes "the `Any`
  described by the EDAG spec"
  ([mvp-roadmap](../../../nanvm-lib/todo/mvp-roadmap.md)); the derived case
  expressions are exactly such values. They still need a transport into
  Rust: the roadmap defers generic `Any` serialization to post-MVP, and the
  repository's cross-language bridge is generated Rust — so the printer
  grows a second output that *constructs* each derivable case's expression
  as an `Any` and hands it to the interpreter, next to the direct-operator
  tests it prints today. Authoring stays single-source; only the transport
  is generated. Once the deferred `Any`/CBOR serialization lands, the same
  expressions can ship as serialized data instead. Either way the corpus is
  the "conformance examples (test vectors) shared by the FJS and Rust
  implementations" that [edag-spec](../../../todo/edag-spec.md) asks for,
  and it is what keeps the interpreter and the generated code in agreement —
  the point the roadmap's test-generation item makes.

The next operators the roadmap needs — `&&` `||` `??` — are already in
`op2Id`, with laziness that is positional, not nodal. With constant operands a
corpus case cannot observe non-establishment; pin their value results now, and
add non-establishment cases (a `['throw', …]` operand in the lazy position)
once that node joins the schema.

#### `eq` and node sharing

The `eq` section is `['===', a, b]` with test-only structure on top: `shared`
plus `ref` is node sharing spelled by name, and `eq: boolean` is `expected`.
Unifying it into an ordinary `'==='` `Group2` is deliberately **not** part of
this task — its dual-name cases (`name2`) and symmetric `b === a` check don't
fit `Case<2>` yet — but the lowering above must treat `ref` as sharing from
the start, and step 3's consumers must be identity-aware (the evaluator's
per-case memo, the printer's shared bindings), so that `arrayByItself` and
`objectByItself` keep meaning "the same object" and the later unification is
a data move, not a redesign.

### Operations without a canonical EDAG operation

An operation the corpus needs before the EDAG design reaches it must not cause
`fjs/nanvm/` to invent a permanent EDAG spelling. Either define it in the
canonical vocabulary first, if it belongs there, or keep the group as a
`NonEdagGroup` (step 1) until then — the exception visible in the type model,
never a NaNVM-only name mixed into a supposedly canonical id union. Today the
only such case is `unaryPlus`, already scheduled to become `Number` by
[replace-unary-plus-with-number](../../../nanvm-lib/todo/replace-unary-plus-with-number.md).

### Tasks

Step 1 — vocabulary:

- [ ] Replace the local `Op` union in [`types.ts`](../types.ts) with `Op1Id`/
      `Op2Id` imported from `fjs/edag/types.ts`: `Group1`/`Group2` as above,
      `Case<N>` with `Tuple<N, Value>` args, `commutative` on `Group2` only.
- [ ] Add type-level proofs that wrong operand counts are rejected.
- [ ] Migrate the data in [`module.f.mjs`](../module.f.mjs): `unaryMinus` →
      `neg`, `mul` → `*`, `stringCoercion` → `String`. Keep `unaryPlus` as
      the one `NonEdagGroup` — same cases, same generated output — until
      `replace-unary-plus-with-number.md` turns it into `Number` and deletes
      that type.
- [ ] Update [`proof.f.mjs`](../proof.f.mjs) to dispatch on the canonical ids,
      preserving case proof keys and the `Swapped` convention.
- [ ] Update [`rust/module.f.mjs`](../rust/module.f.mjs): an explicit id →
      Rust expression/function-name map; no `snakeCase` over punctuation tags;
      Rust identifiers stay local to the printer.
- [ ] Regenerate `nanvm-lib/tests/test/generated.rs`, preserving existing test
      names, semantics, and coverage.

Step 2 — cases as EDAG values:

- [ ] Implement the `Value` → constant-`Exp` lowering (`undefined`, arrays,
      objects, primitives; `ref` as literal node sharing; `functionValue` as
      the explicit non-EDAG escape).
- [ ] Derive an `Exp` for every case whose operands lower, and `validate` it
      against the `exp` schema in the proof, so each derived case is a
      well-formed EDAG and a schema change fails the proof instead of
      silently going unnoticed. Cases with a `functionValue` operand keep
      the direct-value path, visibly marked.

Step 3 — execution:

- [ ] Evaluate the derived expression in the proof (constant-subset evaluator
      now; the `interpret-edag` interpreter when it lands), memoizing nodes
      by identity within a case so shared nodes evaluate once and identity
      cases stay true.
- [ ] Print the Rust tests from the derived expression rather than from a
      parallel reading of the case, emitting a shared `let` binding for any
      multiply-referenced node.
- [ ] Extract the corpus-format rules both consumers re-implement — the
      commutative `orders` expansion with its `Swapped` naming, and the
      `throws`-marker probe — into the shared data module, imported by the
      proof and the printer ([corpus-eliminators](./corpus-eliminators.md)).
- [ ] When the `nanvm-lib` interpreter lands, extend the printer to construct
      the same expressions as `Any` values and hand them to it (serialized
      `Any` once the roadmap's post-MVP serialization exists), and register
      the corpus as the shared conformance vectors of
      [edag-spec](../../../todo/edag-spec.md).
- [ ] Extend the corpus to `&&` `||` `??`; add non-establishment cases once
      `['throw', exp]` is in the schema.

Throughout:

- [ ] `npx tsc`, `fjs test`, `npm run ci-update`, `cargo test`,
      `cargo clippy -- -D warnings`, and `cargo fmt -- --check`.

### Related

- [`fjs/edag/`](../../edag/README.md) — the canonical schema and types this
  reuses: `op1Id`/`op2Id` in `module.f.mjs`, `Op1Id`/`Op2Id` in `types.ts`.
- [`../../../todo/edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md)
  — the operator vocabulary's design of record: word-tag `neg`, no unary `+`,
  positional laziness, the future `throw`/`?:`.
- [`../../../todo/edag-spec.md`](../../../todo/edag-spec.md) — the module
  boundary, the Rust-from-RTTI generation plan, and the shared conformance
  test vectors the corpus becomes.
- [`../../../nanvm-lib/todo/mvp-roadmap.md`](../../../nanvm-lib/todo/mvp-roadmap.md)
  — the interpreter and remaining-operators items this feeds.
- [`../../../nanvm-lib/todo/replace-unary-plus-with-number.md`](../../../nanvm-lib/todo/replace-unary-plus-with-number.md)
  — retires `unaryPlus` in favor of the canonical `Number`.
- operator-test-operation-model (retired; superseded by this issue)
  — the local `[name, argsN]` model; its still-applicable
  requirements (stable names and `Swapped`, faithful literals in diagnostics,
  static arity rejection, consumer-owned mappings) are folded in above.
  Original reviews: [#1489 r3770780551](https://github.com/functionalscript/functionalscript/pull/1489#discussion_r3770780551),
  [#1489 r3770797058](https://github.com/functionalscript/functionalscript/pull/1489#discussion_r3770797058).
- [`./corpus-eliminators.md`](./corpus-eliminators.md) — deduplicates the
  corpus rules (`Swapped` expansion, the `throws` probe) the consumers
  currently re-implement; step 3 carries that extraction as an explicit task.
