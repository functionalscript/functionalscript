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

Re-inspected at `186af0b` with a differential corpus of a few hundred
modules — lexical edge cases, key order and duplicates, property access,
unary-minus coercion, number and string round trips, sharing across
`const`, imports, symlinks and JSON modules, and function arity — each run
through Node and compared with the `.data.js` and `.js` outputs, and a
sample with the `.rs` output on the naive VM. No accepted program computed
a different result and no invalid program was accepted; every difference
was a refusal. The one output defect found was a wrong kind of failure,
not a wrong value — a string the `.rs` writer could not spell was thrown
past the compiler or written as a file `rustc` refused — and
[`fjs/media/rust`](../fjs/media/rust/module.f.mjs) now spells or refuses
each such literal.

#### Module resolution — current implementation, rule 2

[Module-resolution compatibility](../fjs/fsc/todo/module-resolution-compatibility.md)
owns the escaped-filename reproducer, shared resolution contract and regression
work. Source specifiers, resolved module identities and filesystem locations
must not be conflated. The concrete compiler task is co-located with `fjs/fsc`,
not duplicated here.

#### Source decoding and the `toString` radix — current implementation, rule 2

At `36c8d4a`, two defects outside the corpus above give an accepted program
a value JavaScript does not. A source that is not correct UTF-8 is decoded
rather than refused, so a raw `FF` in a string literal is U+00FF where Node
reads U+FFFD
([malformed UTF-8 source](../fjs/fsc/todo/malformed-utf8-source.md)). And
the `.rs` output, run by `nanvm-lib`, answers `"255"` for
`(255).toString(16)`, which JavaScript answers `"ff"`
([member functions](../nanvm-lib/todo/member-functions.md)). Each is refused
first, in the issue that owns it; the radix is implemented after.

#### Expression grammar — corrected, rule 1

[PR #2089](https://github.com/functionalscript/functionalscript/pull/2089)
admitted a unary expression to the left of exponentiation,
`export default - 2 ** 2;`, which JavaScript rejects. Stage A landed in
[#2106](https://github.com/functionalscript/functionalscript/pull/2106)
instead, and its `c1d7166` refuses `**` immediately after a `-`/`~` operand
at any nesting through the grammar's `unaryOperand`, as ECMAScript's
[exponentiation](https://tc39.es/ecma262/multipage/ecmascript-language-expressions.html#sec-exp-operator)
does; `fjs/fsc/parser/proof.f.mjs` holds the refusals and the valid
`(-2) ** 2` and `-(2 ** 2)`. What is left is the comparison against a native
JavaScript engine's early errors, and extending that gate to the
logical/nullish operators and parameter syntax, which have since landed. The
[operator plan](../spec/todo/2340-operators.md) owns the operators.

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

#### Function text — adopted exception, rendering questions open

The owner adopted the [function-source representation exception](../spec/README.md#function-source-representation-exception).
FJS VMs reconstruct default function text from associated EDAG instead of
retaining authored spelling. Direct and indirect conversions, including
function-derived keys and source-text observations through exports, are covered.
A changed key or branch caused by that text is a consequence of this exception;
unrelated differences remain bugs. No `entry`-specific export prohibition or
attempt to catch every conversion spelling is required.

**Root-cause implementation:** one default function-representation operation
used wherever normal conversion reaches it. Do not confuse that operation with
the surrounding conversion rules, and do not derive it from mutable execution
or optimization state. Function allocation identity and arity are unchanged.
Ordinary JavaScript execution retains the host's representation.

**Observed at `186af0b`:** the `.js` output already renders every function
from the graph — `() => 1` is written `(...$a)=>1` — so a JavaScript
consumer of that output sees different text, as adopted. The function's
`name` differs too, which this exception does not cover; that is the
correction below.

[Function text and serialization](../spec/todo/serialization.md#function-text-and-serialization)
owns the three open questions: whether the FSC function serializer and `String`
are the same function, whether `String` instantiates a frame (the owner's
preference is substituting captured values), and how each handles `self`.
No exact spelling or closure/self strategy is selected by this exception.
Earlier no-exception/refusal directions for authored-text differences are
superseded; implementing the chosen rendering contract remains work.

#### Function name — not a compatibility observation

A compatibility issue exists only where the same program returns different
serializable data on an FJS VM and a JavaScript engine
([principles](../spec/README.md#principles)). What a JavaScript engine
reports about `fsc`'s *written* output is the writer's spelling, not a
result of the program, so the `.js` writer's names — a hoisted function
bound as `$0`, an inlined one taking the name of the position it is written
in — are no compatibility question, and neither is the function text the
exception above covers. No FJS program reads a function's name at all:
[`entry`](../fjs/edag/todo/entry.md) replaced the own-property read with
the enumerable-entry helper so that it cannot — `person.name` is enumerable
where `f.name` and `f.length` are not — and retired the proposals that would
have exposed it, `own-access.md` and `function-name.md`, in `4f4da828`;
`f.name` is refused at the key, `entry(f, 'name')` is `undefined`, and
[the language](../spec/README.md#functions) carries no name in the graph.
The property-access and presence plans,
[2330](../spec/todo/2330-property-accessor.md) and
[2345](../spec/todo/2345-has-own-property.md), hold the same boundary from
the source side. The corpus gate below compares the serializable data each
execution returns, never the written text or what an engine reports about
it.

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
it remains in `todo/blocked/`, it neither directs nor blocks current development.

### Preventive gates, not established defects

Observable arity shipped with the
[parameter plan](../spec/todo/3120-parameters.md) in
[#2237](https://github.com/functionalscript/functionalscript/pull/2237):
a function's EDAG carries its fixed-parameter count, so this module lowers
`f` and `g` to lengths one and two:

```js
const f = a => 0;
const g = (a, b) => 0;
export default [f.length, g.length]; // [1, 2]
```

Rest-only and empty lists both have arity zero; general lists do not. Erasing
this distinction while admitting `.length` would be P1, so every later
feature that changes how a function is built repeats this check. Keep purity,
explicit inputs, deterministic successful computation and checked host
boundaries as independent requirements; compatibility alone would allow
randomness and external mutation.

### Tasks

- [x] Record the approved compatibility/failure contract in the authoritative
      language principles; retain purity and link the specification roadmap.
- [x] Replace the token-bypass design with mandatory statement-aware AST
      recognition and retire the proposed `Object.hasOwn` source pattern.
- [x] **P1:** apply the settled failure contract to the
      [operator plan](../spec/todo/2340-operators.md) and align the
      [representation examples](../spec/todo/1015-undefined-property-vm-layer.md)
      with complete proposed patterns or explicitly labeled JavaScript-only
      oracles. Execution/optimization and regression work remains below.
- [x] **P1:** implement the linked module-resolution correction and its real
      FJS/native-ESM escaped-filename regression.
- [ ] **P1:** refuse a source that is not correct UTF-8, as
      [malformed UTF-8 source](../fjs/fsc/todo/malformed-utf8-source.md)
      plans.
- [ ] **P1:** refuse a `toString` radix in `nanvm-lib` until the radix is
      implemented ([member functions](../nanvm-lib/todo/member-functions.md)).
- [ ] **P1:** compare the operator grammar's refusals with a native
      JavaScript engine's syntax and early errors, and extend that gate to
      the logical/nullish operators and parameter syntax.
- [ ] **P1:** implement statement-aware pattern recognition before shipping
      intrinsics; its linked TODO separates the mandatory boundary from ASI
      syntax expansion and preserves refusal until syntax is understood.
- [x] Record the adopted function-source exception and the three open
      serializer/`String`, frame and `self` questions in the owning documents.
- [ ] **P1:** implement and test the chosen function-rendering contract across
      source, EDAG, coercion and execution; preserve other function observations.
- [x] Record that a function's name is no compatibility observation: no
      FJS program reads one, by `entry`'s decision, and what an engine
      reports about the written output is the writer's spelling.
- [ ] **P1:** preserve the property-observation and composition contract in
      each affected implementation. Missing support is refused, not guessed.
- [ ] **P1:** extend the existing host harness with a shared compatibility
      corpus. Check accepted original text as JavaScript module source, then
      compare the serializable data original-JS, EDAG, generated-JS and
      supported native executions return. Exercise exported functions; do
      not compare only normalized source, and do not compare the written
      text or what an engine reports about it.
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
