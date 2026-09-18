## Preserve JavaScript compatibility

**Priority:** P1
**Status:** open

### Problem

FunctionalScript must remain a subset of JavaScript at every development
stage. Missing support is acceptable; accepting invalid JavaScript or
successfully computing a different, unspecified result is not.

This is the cross-cutting compatibility gate for the parser, linker, EDAG,
writers, native execution and language proposals. The feature documents linked
below own their implementations; this issue owns the invariants and the
compatibility corrections they must make. A feature's ordinary priority does
not downgrade a violation: **every current or proposed violation below is P1**.
An unimplemented feature need not be completed to close its blocker; correcting
its incompatible design and keeping unsupported input refused is sufficient.

### Contract

1. **Source inclusion.** Every accepted FJS source module is valid JavaScript
   module source, including lexical restrictions and early errors. Check the
   original text, not text repaired, stripped or rewritten by a transpiler.
2. **Successful-result agreement.** For the same admitted inputs and dependency
   environment, successful FJS and JavaScript executions have the same
   observable result, except for explicitly specified semantic exceptions.
   This includes observations through exported functions and later operations,
   not just the initial module value.

State the supported ECMAScript and host-resolution environment. A bare module
specifier is host-defined; Node package resolution and browser import maps
must not be silently replaced with a private filesystem convention.

An exception names its profile, operations and consequences. Content identity
in a CAVM is not a blanket excuse for JS-compatible execution, function-text
changes, or arbitrary value differences. An identity difference can propagate
into a boolean, a property lookup or a branch result, so an output comparator
cannot just ignore objects. Do not create a new exception merely to close a bug.

#### Failure is one outcome

**Decision:** throwing paths are indistinguishable from each other and from
any other execution failure, including memory or time exhaustion:

```text
throw A ≡ throw B ≡ memory failure ≡ time failure
```

There is no language-level guarantee of an error type, message, stack, source
position, the first failing node, or the work performed before failure. Host
logging and diagnostic stop reasons may remain operational information; they
must not become program-observable values that distinguish these failures.
Syntax rejection remains a compiler property and is not excused by this rule.

This deliberately permits optimizing successful EDAG computations and
reordering failing computations to fail earlier. Do not introduce source-order
execution barriers, exact evaluation-count requirements, or equal resource
thresholds across engines merely to preserve failure behavior. These both fail:

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

They need not fail at the same operation. Conversely, failure indistinguishability
is not permission to invent a successful result by deleting a required failure,
or to execute an otherwise skipped failure on a successful path:

```js
export default false && null.x; // successful false; the access is not demanded
```

Resource limits can still stop a run, and a more efficient executor can finish
where another exhausts resources. Matching wall-clock limits, heap limits or
host stack-overflow points is not a compatibility requirement. A stopped run
is a failure, never a guessed successful value. Do not promote failure timing,
error ordering or performance alone to P1 compatibility defects.

#### Fix the semantic cause

Each correction must identify the violated semantic boundary, repair its shared
contract or representation, and test the family of cases it governs. A special
case for one spelling, a growing blacklist of counterexamples, or a VM fallback
returning a plausible value is not a root-cause fix. A deliberately incomplete
supported domain can refuse input, but its boundary must follow the semantic
contract rather than hide a demonstrated mismatch.

### P1 corrections

The implementation observations below were inspected at
`1b4d0218ab93f2abc812b5e79f7fe4cb8d91b3d7`. Proposed conflicts are identified
as such; they are not claims that those features already execute in FJS.

#### Module resolution — current implementation, rule 2

[`fjs/fsc/transpiler`](../fjs/fsc/transpiler/module.f.mjs)'s `_importPath`
joins and normalizes filesystem paths; the
[EDAG linker](../fjs/fsc/edag/module.f.mjs) reuses it. A module specifier is
not a filesystem path. For example, create these sibling files:

```js
// main.mjs
import value from "./%64ep.mjs";
export default value;

// dep.mjs
export default 1;

// %64ep.mjs — the filename contains a literal percent sign
export default 2;
```

Native Node ESM resolves the import to `dep.mjs` and returns `1`. The current
filesystem join points at the literal `%64ep.mjs`, which contains `2`.
This is a source-inspected FJS mismatch; the end-to-end FJS regression is a
required task below, not a claimed completed test.

**Root-cause correction:** give compilation one module-resolution contract,
shared by the value path and EDAG path, that separates a source specifier,
resolved module identity and filesystem loading location. Use the declared
host's URL/package rules, and derive module-cache keys from the same identity.
Handle URL-to-path conversion at the filesystem boundary, not with a `%64`
replacement or a special ban on this filename. Unsupported specifier classes
must be explicitly refused rather than interpreted as relative paths.

Test escaped filenames, equivalent URL spellings, query/fragment identities,
relative paths, module types/import attributes and bare specifiers. Do not
require every class to be implemented immediately; accepted classes must agree
with the host. [Node's resolution rules](https://nodejs.org/api/esm.html#resolution-and-loading-algorithm)
are the reference for the Node profile.

#### Expression grammar — proposed implementation, rule 1

[PR #2089](https://github.com/functionalscript/functionalscript/pull/2089),
inspected at head `853faaf88a7adad39460926da58369d87b18691e`, deliberately
admits a unary expression to the left of exponentiation:

```js
export default - 2 ** 2; // JavaScript rejects this
```

**Root-cause correction:** encode ECMAScript's expression categories,
precedence and early restrictions in the grammar and semantic validation. Do
not change JavaScript's meaning to make an LL(1) production convenient, and do
not patch only the text `- 2 ** 2`.

Test unary operators as a class, trivia variants, nesting and the valid
alternatives `(-2) ** 2` and `-(2 ** 2)`. Extend the same gate when adding
logical/nullish operators, grouping and parameter syntax. The
[operator plan](../spec/todo/2340-operators.md) owns the implementation;
[ECMAScript exponentiation](https://tc39.es/ecma262/multipage/ecmascript-language-expressions.html#sec-exp-operator)
is the semantic reference.

#### Intrinsic patterns — proposed design hole, rules 1 and 2

The [`entry` proposal](../fjs/edag/todo/entry.md) treats its helper definition
as a token pattern with freely interchangeable whitespace. That wording must
not permit this different, valid JavaScript function to match the intrinsic:

```js
const entry = (a, b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return
    x?.enumerable ? x.value : undefined;
};
export default entry({ answer: 7 }, "answer"); // undefined, not 7
```

A newline before `=>` is a syntax error instead. Newlines inside block
comments count too. These are requirements for the proposed recognizer, not
an assertion that it is implemented incorrectly today.

**Root-cause correction:** intrinsic recognition must reuse the parser's
JavaScript lexical, binding and early-error rules, including line-terminator
information, rather than match an undifferentiated token sequence. A pattern
may precede general support for its constructs, but cannot bypass their
meaning. Identifier placeholders must preserve binding relationships, legal
names and required distinctness; `Object` must resolve to the intended
intrinsic, not a shadowing binding. Share these checks across patterns.

Test equivalent layouts that must match and syntactically invalid or
semantically different layouts that must not, following
[automatic semicolon insertion](https://tc39.es/ecma262/multipage/ecmascript-language-lexical-grammar.html#sec-automatic-semicolon-insertion).

#### Function reflection — proposed divergence, rule 2

The [`entry` proposal](../fjs/edag/todo/entry.md) permits function-to-property-key
coercion while [serialization](../spec/todo/serialization.md) gives functions
canonical graph-derived text. With the proposal's ordinary JavaScript helper:

```js
const f = (...a) => a;
const object = { "(...a) => a": 7 };
export default entry(object, f); // 7
```

Renaming/reformatting the function as `(...$a)=>$a` changes the key and yields
`undefined`. Both executions succeed. An array containing the function, or
user-defined coercion, can expose the same difference indirectly. Prohibiting
`.name` or just a direct function key does not close that observation.

**Root-cause correction:** define the allowed function observations once and
make lowering, intrinsic coercion, serialization and every executor preserve
them. Either retain the original observable text, or remove this observation
through compatible source restrictions or explicitly written checked patterns.
Do not silently redefine JavaScript's coercion. A canonical-function-text
exception would require an explicit separate decision and specification; this
TODO does not approve one. Test the original source against execution and
output, not merely normalized source against itself.

#### Property reflection — proposed alternatives, rule 2

[`entry`](../fjs/edag/todo/entry.md),
[`hasOwn`](../spec/todo/2345-has-own-property.md) and the
[built-in plan](../spec/todo/2360-built-in.md) must distinguish property
presence, enumerability and value:

```js
Object.hasOwn([], "length")           // true
Object.hasOwn({ x: undefined }, "x")   // true
Object.getOwnPropertyNames([])         // ["length"]
```

**Root-cause correction:** preserve those distinct observations in the property
model. An admitted standard JavaScript call must answer the question it spells.
Remove the alternatives that redefine `Object.hasOwn` or own-property
reflection as entry/enumerability tests. A differently named helper whose
source explicitly performs an enumerable-entry test is compatible. An
unsupported receiver must not produce a fabricated `false` or `undefined`.
Reconcile the related proposals before implementing them; lower feature
priorities do not allow these alternatives to ship.

#### Undefined-property equivalence — proposed alternatives, rule 2

[Undefined properties](../spec/todo/1010-undefined-property.md) and the
[VM-layer question](../spec/todo/1015-undefined-property-vm-layer.md) cannot
make absence and a present undefined-valued property universally interchangeable:

```js
export default { x: 1, x: undefined }.x; // undefined
```

Dropping the final entry before construction leaves `1`. Even dropping an
undefined-valued property only after constructing a separate object is unsafe:

```js
const a = { x: undefined };
export default { x: 1, ...a }.x; // undefined; substituting {} gives 1
```

Filtered enumeration still exposes the insertion-order difference:

```js
const a = { x: undefined };
export default Object.values({ ...a, y: 1, x: 2 })
    .filter(value => value !== undefined); // [2, 1]; substituting {} gives [1, 2]
```

These are constraints on the proposed equivalence and future spread/enumeration,
not claims that the current AST evaluator strips entries.

**Root-cause correction:** define equivalence over all admitted observation
contexts, not just lookup or JSON output. Preserve presence, overwriting and
observable order through construction and composition; normalize only where
that equivalence is established. Adding an operation must recheck the
assumptions behind earlier normalization. Filtering a final enumeration cannot
repair an earlier loss of overwrite or insertion-order information.

### Preventive gates, not established defects

**P2:** extend the [named-parameter plan](../spec/todo/3120-parameters.md)
with observable arity before choosing its lowering:

```js
const f = a => 0;
const g = (a, b) => 0;
export default [f.length, g.length]; // [1, 2]
```

Rest-only and empty lists both have arity zero; general lists do not. An
implementation that erases this distinction while admitting `.length` would
be a P1 violation. The plan's lack of detail is not evidence that it already
does so. Apply the same observation audit to captures and future intrinsics.

Keep purity, explicit inputs, deterministic successful computation and checked
host boundaries as independent requirements: JavaScript compatibility alone
would allow a faithful implementation of random values or external mutation.
Do not silently turn these additional gates into newly approved source features.

### Tasks

- [ ] **P1:** record the contract and indistinguishable-failure decision in the
      language specification and EDAG execution/optimization documentation.
      Reconcile any exact computation-count or failure-detail requirements
      with it; preserve identity observations required by the selected profile.
- [ ] **P1:** give all compiler paths the shared module-resolution contract above
      and add a real FJS/native-ESM regression using both escaped-name files.
- [ ] **P1:** correct the proposed expression grammar as a grammar, and test
      acceptance against native JavaScript parsing and early-error checks.
- [ ] **P1:** correct intrinsic-pattern recognition around shared lexical and
      binding semantics; amend `entry`'s unrestricted-whitespace wording.
- [ ] **P1:** settle function observability across source, EDAG and execution;
      remove the assumption that canonicalizing first proves source compatibility.
- [ ] **P1:** reconcile `entry`, `hasOwn`, built-ins and undefined-property
      proposals with the property-observation and composition rules above.
      Their incompatible alternatives are blocked by this issue, regardless of
      the surrounding feature's lower priority.
- [ ] **P1:** extend the existing host test harness with a shared compatibility
      corpus. Every accepted source fixture must pass untransformed JavaScript
      module syntax/early-error checks. Compare successful original-JS, EDAG,
      generated-JS and supported native executions under one declared profile.
      Keep unsupported outputs as explicit refusals, not guessed values.
- [ ] **P1:** compare numbers with `Object.is`-appropriate distinctions, bigint
      separately, strings as code units, property order, and the aliasing and
      function observations the profile promises. Do not use JSON stringification
      as the sole comparator. Exercise exported functions on admitted inputs.
- [ ] **P1:** classify every execution failure as the same outcome in semantic
      proofs. Test reordered failing graphs and untouched successful lazy paths;
      do not require matching error payloads, work counts or resource limits.
- [ ] **P1:** apply the same gates to optimization, graph round trips, linking
      and warm/cold caches. Specify existing exceptions with their propagation
      into later observations; new exceptions require an explicit decision.
- [ ] **P2:** add the arity gate to the parameter design and audit observation
      closure before adding captures, mutation or another intrinsic.

Use the repository's existing runners and an independent native-JavaScript
oracle; do not introduce an external tool or source-text grep as a substitute
for parsing. The implementations land with their regressions and required
checks. This issue is not a demand to finish the language, synchronize all
backend feature sets, redesign the parser, or harden every resource limit first.

### Related

- [Language principles](../spec/README.md#principles) — source compatibility
  and purity.
- [Execution models](../fjs/edag/execution-models.md) — JS-compatible execution
  versus explicit alternative identity models.
- [Compile modules to EDAG](../fjs/fsc/todo/compile-modules-to-edag.md) —
  lowering and linking; these gates hold at every stage.
- [Interpreter resources](../fjs/fsc/todo/bound-edag-interpreter-resources.md)
  — operational budgets, not observable distinctions between failures.
