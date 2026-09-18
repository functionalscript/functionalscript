## Preserve JavaScript compatibility

**Priority:** P1
**Status:** open

### Problem

FunctionalScript must remain a subset of JavaScript at every development
stage. Missing support is acceptable; accepting invalid JavaScript or
successfully computing a different, unspecified result is not.

This epic owns the cross-cutting compatibility gates. Linked feature and
module TODOs own implementation details. **Every current or proposed violation
is P1**, regardless of the feature's ordinary priority. Correcting an
unimplemented feature's incompatible design does not require completing it.

### Proposal

#### One authoritative contract

[Language principles](../spec/README.md#principles) define source inclusion,
successful-result agreement and purity. The same section defines
[failure equivalence](../spec/README.md#failure-is-one-outcome): throws and
memory/time failures are indistinguishable. This is an approved decision,
not a refinement awaiting a later specification edit.

Preserve successful lazy paths; permit reordering failing computations to
fail earlier. Do not require matching error details, first failing nodes,
evaluation counts or resource thresholds. These both fail and need not fail
at the same operation:

```js
const a = null.x;
const b = 1n / 0n;
export default 7;
```

```js
const b = 1n / 0n;
const a = null.x;
export default 7;
```

But this is a successful path whose skipped access must stay skipped:

```js
export default false && null.x; // false
```

An exception names its execution profile, affected operations and consequences.
An identity difference can propagate into a boolean or branch result; a test
cannot merely ignore object outputs. Do not invent exceptions to close bugs.

#### Fix the semantic cause

Repair the shared contract or representation and test the family of cases it
governs. A spelling-specific patch, blacklist of counterexamples or plausible
fallback value is not a root-cause correction. An incomplete supported domain
may refuse input, but cannot silently give it another meaning.

### P1 corrections

Implementation observations were inspected at
`1b4d0218ab93f2abc812b5e79f7fe4cb8d91b3d7`. Proposed conflicts are not claims
that those features already execute in FJS.

#### Module resolution — current implementation, rule 2

[Module-resolution compatibility](../fjs/fsc/todo/module-resolution-compatibility.md)
owns the escaped-filename reproducer, shared resolution contract and regression
work. Source specifiers, resolved module identities and filesystem locations
must not be conflated. The concrete compiler task is co-located with `fjs/fsc`,
not duplicated here.

#### Expression grammar — proposed implementation, rule 1

[PR #2089](https://github.com/functionalscript/functionalscript/pull/2089),
inspected at head `853faaf88a7adad39460926da58369d87b18691e`, deliberately
admits a unary expression to the left of exponentiation:

```js
export default - 2 ** 2; // JavaScript rejects this
```

**Root-cause correction:** encode ECMAScript's expression categories,
precedence and early restrictions in the grammar and semantic validation.
Do not change JavaScript to make an LL(1) production convenient. Test unary
operators as a class, trivia variants, nesting and the valid alternatives
`(-2) ** 2` and `-(2 ** 2)`. Extend the gate with logical/nullish operators
and parameter syntax.

The branch's original lack-of-parentheses rationale no longer applies:
grouping landed in `f005d51`. The deviation violated source inclusion even
before grouping existed. The [operator plan](../spec/todo/2340-operators.md)
owns the work; [ECMAScript exponentiation](https://tc39.es/ecma262/multipage/ecmascript-language-expressions.html#sec-exp-operator)
is the reference.

#### Pattern instructions — proposed bypass, rules 1 and 2

**Every pattern instruction MUST be recognized at a level where statements
and expressions have already been recognized correctly.**

The former [`entry` design](../fjs/edag/todo/entry.md) proposed a fixed token
shape that could bypass syntactic support for the constructs inside it.
Ignoring whitespace before statement recognition is the root problem, not a
missing newline exception in one intrinsic. This whitespace-only change to the
helper returns `undefined` in JavaScript, not `7`:

```js
const entry = (a, b) => {const x = Object.getOwnPropertyDescriptor(a, b);return
x?.enumerable ? x.value : undefined}
export default entry({ answer: 7 }, "answer");
```

There is no extra semicolon after the final `undefined`: only the space after
`return` changed to a newline. Separately, this arrow is invalid JavaScript:

```js
const f = (...a)
=> a;
export default f;
```

**Current parser:** the ordinary grammar already applies `sameLine` after
`return` and before `=>`; the tokenizer preserves newline information,
including CR/LF inside block comments. The grammar proofs cover these refusals.
The bad intrinsic match was proposed, not observed in a running matcher.

**Root-cause correction:** use one JavaScript syntactic front end, then
binding/early-error validation, then whole-AST-pattern recognition and FJS
admission, then EDAG lowering. The matcher does not read newlines or insert
semicolons. It consumes structure in which those questions are settled.
Unsupported parsed constructs are refused, not reinterpreted. A pattern may
admit otherwise-prohibited operations only inside its complete matched subtree;
parsing that syntax does not expose the descriptor or the global namespace as
an ordinary FJS value.

[Statement-aware intrinsics](../fjs/fsc/parser/todo/statement-aware-intrinsics.md)
owns this boundary and the planned JavaScript statement/ASI work. Optional
semicolons are a syntax expansion, not a substitute for AST matching. Requiring
semicolons today is not itself a compatibility defect.

#### Function reflection — proposed divergence, rule 2

`entry.md` already acknowledges that [serialization](../spec/todo/serialization.md)
uses canonical function text while JavaScript sees authored text. The
compatibility problem is that normalization can change successful observations:

```js
const f = (...a) => a;
const object = { "(...a) => a": 7 };
export default entry(object, f); // 7 with the proposed ordinary JS helper
```

Renaming/reformatting `f` as `(...$a)=>$a` changes the key and yields
`undefined`. Arrays containing a function and user-defined coercion can expose
it indirectly. Normalized output agreeing with itself is not a proof about
the original source.

**Root-cause correction:** define permitted function observations once, and
preserve them across parsing, lowering, coercion, serialization and execution.
Either retain observable source information or remove the observation through
compatible restrictions or explicitly written checked patterns. A canonical-text
exception requires a separate explicit decision; none is approved here. This
gate also applies to the new enumerable-presence pattern's key coercion.

#### Property reflection — incompatible alternatives withdrawn

**Decision:** prohibit `Object.hasOwn` in FJS source rather than redefine it
as an enumerability test. Use a separate, explicitly spelled
[enumerable-presence pattern](../spec/todo/2345-has-own-property.md), with
`hasEntity` as its working name:

```js
const hasEntity = (a, b) =>
    Object.getOwnPropertyDescriptor(a, b)?.enumerable;
```

This exact expression returns `true`, `false` or `undefined`. A boolean-only
version must spell `=== true` explicitly; it is not an equivalent replacement.
The TODO records that API choice rather than silently deciding it.

The old `hasOwn` proposal already required extending or refusing unsupported
receivers rather than returning a fabricated boolean. Its enumerability
redefinition was proposed by `entry.md`, not by that receiver rule. The new
direction retires standard-call recognition and its unresolved undefined-value
answer instead of requiring an implementation of it.

**Root-cause correction:** separate the language's data-entry API from standard
own-property reflection. Standard APIs retain their JavaScript meanings even
when prohibited. Descriptor operations are available only inside validated
patterns; neither descriptor values nor unrestricted own-property reflection
are admitted by this decision. Host implementation code is not automatically
rewritten by a source-language restriction.

#### Undefined properties — constrain equivalence by observations

The active [undefined-property](../spec/todo/1010-undefined-property.md) and
[VM-layer](../spec/todo/1015-undefined-property-vm-layer.md) plans must preserve
construction, overwrite and observable-order semantics:

```js
export default { x: 1, x: undefined }.x; // undefined, not 1
```

```js
const a = { x: undefined };
export default { x: 1, ...a }.x; // undefined; replacing a with {} gives 1
```

```js
const a = { x: undefined };
export default Object.values({ ...a, y: 1, x: 2 })
    .filter(value => value !== undefined); // [2, 1], not [1, 2]
```

The proposed descriptor-enumerability pattern also reads `true` for an
ordinary `{ x: undefined }` entry and `undefined` for a missing one. Equality
of direct value reads or filtered output does not establish substitutability.

**Root-cause correction:** define equivalence over all admitted observation
contexts and recheck it when adding an operation. Normalize only where that
equivalence is proved. Filtering a final enumeration cannot repair an earlier
loss of overwrite or insertion-order information. These are proposal constraints,
not a claim that the current evaluator strips entries or supports spread.

[Undefined-as-absence research](./blocked/undefined-removes-property.md) is
blocked research, not an active implementation direction or dependency. While
it remains in `todo/blocked/`, it neither directs nor blocks current development;
its clarification is separate work in #2104.

### Preventive gates, not established defects

**P2:** extend the [parameter plan](../spec/todo/3120-parameters.md) with
observable arity before choosing its lowering:

```js
const f = a => 0;
const g = (a, b) => 0;
export default [f.length, g.length]; // [1, 2]
```

Rest-only and empty lists both have arity zero; general lists do not. Erasing
this distinction while admitting `.length` would be P1. A thin TODO is not
evidence that such an implementation exists. Keep purity, explicit inputs,
deterministic successful computation and checked host boundaries as independent
requirements; compatibility alone would allow randomness and external mutation.

### Tasks

- [x] Record the approved compatibility/failure contract in the authoritative
      language principles; retain purity and link the specification roadmap.
- [x] Replace the token-bypass design with mandatory statement-aware AST
      recognition and retire the proposed `Object.hasOwn` source pattern.
- [ ] **P1:** reconcile EDAG execution/optimization documentation with the
      specification; no exact failure-detail or computation-count guarantees.
- [ ] **P1:** implement the linked module-resolution correction and its real
      FJS/native-ESM escaped-filename regression.
- [ ] **P1:** correct the operator grammar and run native-JS syntax/early-error
      comparisons before admitting the proposed expressions.
- [ ] **P1:** implement statement-aware pattern recognition before shipping
      intrinsics; its linked TODO separates the mandatory boundary from ASI
      syntax expansion and preserves refusal until syntax is understood.
- [ ] **P1:** settle function observability across source, EDAG and execution.
- [ ] **P1:** preserve the property-observation and composition contract in
      each affected implementation. Missing support is refused, not guessed.
- [ ] **P1:** extend the existing host harness with a shared compatibility
      corpus. Check accepted original text as JavaScript module source, then
      compare original-JS, EDAG, generated-JS and supported native executions.
      Exercise exported functions; do not compare only normalized source.
- [ ] **P1:** compare number distinctions such as `-0` and `NaN`, bigint,
      string code units, property order, aliasing and allowed function
      observations. JSON stringification alone is not a sufficient comparator.
- [ ] **P1:** classify all execution failures as one semantic outcome. Test
      reordered failures and preserved successful lazy paths, not matching
      error payloads, work counts or resource thresholds.
- [ ] **P1:** apply the same gates to optimization, graph round trips, linking
      and warm/cold caches. Specify existing exceptions and their consequences;
      new exceptions require an explicit decision.
- [ ] **P2:** add the arity gate and repeat the observation audit for future
      captures, mutation and intrinsics.

Use existing runners and an independent native-JavaScript oracle, not a
source-text grep or an unapproved external tool as a parsing substitute. The
implementations land with regressions and required checks. This epic does not
require finishing the language, synchronizing all backend feature sets or
hardening every resource limit before making progress.

### Related

- [Language principles](../spec/README.md#principles) — authoritative contract.
- [Execution models](../fjs/edag/execution-models.md) — explicit profiles.
- [Compile modules to EDAG](../fjs/fsc/todo/compile-modules-to-edag.md) —
  lowering and linking, subject to the gates at every stage.
- [Interpreter resources](../fjs/fsc/todo/bound-edag-interpreter-resources.md)
  — operational budgets, not distinguishable language-level failures.
