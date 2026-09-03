# Emergent Testing Framework

This framework discovers and runs **proofs**: plain FunctionalScript values that
verify behaviour. There is no `describe`/`it`/`expect` API — a proof is just a
function or an object tree, so it can be imported, composed, and inspected like
any other value.

## Scope

**In a browser, this framework runs authored FunctionalScript — `.f.mjs` — and
nothing else.** `website/module.f.mjs` selects on the extension and the
generated manifest contains only those modules. That is the design, not a first
iteration: an impure `.mjs` proof means whatever its host gives it — `node:fs`,
`node:vm`, `process`, `node:test`, a filesystem, a subprocess — and a page has
none of those. Loading Node-targeted JavaScript into a browser and expecting it
to test anything is not a goal.

**Under `fjs t` the framework also runs a few impure `.mjs` proofs**, because
some things can only be tested against a real host — the effect interpreters,
and this framework's own browser adapter, which runs in Node against a DOM
stand-in. That is a deliberate, small exception, not an invitation.

**Covering every edge case of plain JavaScript is explicitly not a goal.**
FunctionalScript has no `Promise`, so a proof cannot return one, and the values
that need one to construct — a promise from another realm, a value impersonating
one, a hostile `Symbol.species` — cannot come from a proof either. The runners do
not defend against them. Each case is measured and recorded in
[`todo/imports-promises-realms.md`](./todo/imports-promises-realms.md) with what
a runner does without the defence, and a guard is written the day an input needs
one.

FunctionalScript has no parser or compiler yet, so that rule is held up by the
`.f.mjs` suffix and by review rather than by a check — the browser's selector
matches the suffix and a named `proof` export, nothing more. **A `.f.mjs` that
breaks the rule is a defect to fix, not an exception to design around.** Where
one is found it gets a `todo/` and is removed; the rule is not weakened to
accommodate it.

The two runners are meant to agree. Where they cannot, the difference is
recorded with the reason.

## Concepts

Three terms are used precisely throughout this document:

- **Proof** — the value a module exports under the name **`proof`**. It is a
  tree whose leaves are test cases: either a single zero-argument function, or
  an object/array containing more such trees.
- **Test case** (or just *test*) — a single zero-argument function (`f.length === 0`)
  inside a proof. It is the unit that passes or fails: it **passes** if it
  returns normally and **fails** if it throws (inverted for [throw tests](#throw-tests)).
- **Proof module** — a module that exports `proof`. This is the unit of
  *discovery*: the framework decides what to run by asking "does this module
  export a `proof`?", never by filename alone.

## Running Tests Without DevDependencies

The built-in emergent testing runner can run without adding FunctionalScript to
`package.json` or `deno.json`:

- Node: `npx npm:functionalscript test`
- Deno: `deno run -A npm:functionalscript test`
- Bun: `bunx functionalscript test`

Pin a specific package version by adding it after the package name, for example
`npx npm:functionalscript@0.29.0 test`,
`deno run -A npm:functionalscript@0.29.0 test`, or
`bunx functionalscript@0.29.0 test`.

This only applies to the built-in runner. External runners still need
FunctionalScript installed so the entry file can import
`functionalscript/fjs/emergent_testing/all.test.mjs`.

## Installation

Install FunctionalScript when your repository imports the package, for example
to use external runners through an `all.test.mjs` entry:

```sh
npm install functionalscript
```

or with Deno:

```sh
deno install npm:functionalscript
```

## Running proofs

### `fjs test` (built-in runner)

FunctionalScript's own runner discovers all proof modules automatically — no
entry file required:

```sh
fjs test
```

### External runners (Node, Bun, Deno)

External runners need an entry file that, when loaded, discovers every proof
module and registers each test case with the active runner. The package ships a
ready-made one — re-export it with a bare side-effect import:

```js
// all.test.mjs
import 'functionalscript/fjs/emergent_testing/all.test.mjs'
```

`all.test.mjs` is the recommended name, but any name works as long as the runner
loads it — most pick up `*.test.ts` / `*.test.js` / `*.test.mjs` by default.
Prefer the `.mjs` spelling for `node --test`: whether it discovers a `.ts` entry
depends on that Node version's TypeScript support, which is how this repository's
own coverage run silently reported nothing on Node 23.

Then invoke the runner:

- `node --test`
- `bun test`
- `deno test --allow-read --allow-env --allow-sys`

You can also implement your own runner, as long as it follows the proof-tree
conventions described below.

## Design: dependency-free proofs

Unlike most test frameworks (Jest, Mocha, Vitest, …), a proof does **not** import
anything from the test framework (though it may import the module under test or
other helpers). Because a proof is an ordinary value, it is:

- **runner-agnostic** — the same proof runs under any compatible runner without
  modification;
- **dependency-free** — it stays a pure FunctionalScript module with no
  test-framework imports.

## Discovery: the `proof` export

A module is a proof module **if and only if it exports `proof`**. Discovery is by
*value* — the framework asks "does this module export a `proof`?" — so a filename
alone never causes a module to be executed as a proof.

To answer that question the framework must first load the module. It does so in
two tiers:

| Language | Load gate |
|----------|-----------|
| FunctionalScript (`.f.mjs` / `.f.js`) | **all** files are loaded — FS modules have no import side effects by construction |
| Vanilla TypeScript / JavaScript | opt-in by filename: names ending in `proof.ts`, `proof.js`, `proof.mts`, or `proof.mjs` (e.g. `math.proof.ts`) |

A loaded module that does not export `proof` is silently skipped.

This split is intentional: keeping "is this a proof module?" a property of the
module's *value* rather than its *path* means proofs stay self-describing even
when files are stored by content hash (no stable filename) in a Merkle DAG, or
when source is published and copied as text. The filename gate exists only for
vanilla JS/TS, which — unlike FunctionalScript — may run side effects at import
time and so cannot be loaded indiscriminately.

Authored `types.ts` (and an optional `private.ts`) is neither tier. It holds a
type-level API with no runtime representation, so nothing loads it, it exports no
`proof`, and it carries no proof-coverage obligation — its correctness is what
`tsc` checks, plus whatever `Assert<…>` pins a neighbouring `proof.f.mjs` states
about it. The `proof.ts` row above is the framework's standing support for
vanilla TypeScript, not a repository path: no authored implementation or proof
`.ts` remains after stage 1 of the source migration
([`fjs/fsc/README.md`](../fsc/README.md)).

## Writing proofs

The `proof` export is the proof tree. It is a plain value — no framework import
required. The simplest proof is a single test case:

```ts
export const proof = {
    myTest: () => 42,                  // passes — returns normally
    failing: () => { throw 'oops' },   // fails — throws
}
```

A zero-argument function is a test case. Functions that declare parameters are
ignored and never called.

### Nested objects

Objects and arrays are traversed recursively. Each key becomes a path segment in
the output. Only **own enumerable keys** are visited (as returned by
`Object.entries`); prototype properties are excluded.

```ts
export const proof = {
    math: {
        add: () => { if (1 + 1 !== 2) throw '1 + 1 !== 2' },
        mul: () => { if (2 * 2 !== 4) throw '2 * 2 !== 4' },
    },
    suite: [
        () => { if (typeof '' !== 'string') throw 'expected string' },  // path: suite[0]
        () => { if (typeof 0  !== 'number') throw 'expected number' },  // path: suite[1]
    ],
}
```

### Throw tests

A node named `throw` (or nested inside one) marks test cases that are **expected
to throw**: such a case passes if the function throws and fails if it returns
normally.

```ts
export const proof = {
    throw: {
        divByZero: () => { throw new Error('division by zero') },  // passes
        noThrow: () => 42,                                          // fails
    },
}
```

The `throw` key can appear at any depth; every test case reachable through it
inherits the throw expectation. For example,
`import('proof.ts').proof[5].throw.my()` is a throw test because `throw` appears
in its path. Because the expectation is encoded in the path, no separate marker
is needed in the output — `fjs test` appends `# EXPECTED TO THROW` to such a case
when it passes.

### Return value as a sub-tree

When a non-throw test case returns an object or another function, the return
value is walked as a fresh proof sub-tree. This allows lazy or computed trees:

```ts
export const proof = {
    computed: () => ({
        nested: () => 99,   // discovered and run after `computed()` returns
    }),
}
```

This is how tests are generated dynamically — one named case per input:

```ts
const cases: readonly [number, number, number][] = [[1, 1, 2], [0, 0, 0], [2, 3, 5]]

export const proof = {
    add: () => Object.fromEntries(
        cases.map(([a, b, expected]) => [
            `${a}+${b}`,
            () => { if (a + b !== expected) throw `${a}+${b} !== ${expected}` },
        ])
    ),
}
```

Only **return values** of non-throw test cases are walked. Thrown values are
discarded and never traversed, even if they are objects containing zero-parameter
functions.

### Async tests

A test case may be `async`. The framework awaits the returned `Promise`: the case
passes if it resolves and fails if it rejects. The resolved value is then walked
as a sub-tree, exactly like a synchronous return value:

```ts
import { readFile } from 'node:fs/promises'

export const proof = {
    readSelf: async () => {
        const text = await readFile('package.json', 'utf8')
        if (!text.includes('"name"')) throw text
    },
}
```

## Convention: only real Promises are awaited

When a test case returns a value, the framework checks `value instanceof Promise`
to decide whether to await it. Only genuine `Promise` instances are awaited;
plain *thenables* — objects with a `.then` method that are not `instanceof Promise`
— are treated as ordinary return values and walked as sub-trees.

This is intentional. FunctionalScript does not allow direct `Promise`
construction; `Promise` objects only arise as the return value of `async`
functions (an Effect). A plain `{ then: f }` object in FunctionalScript is almost
certainly a data value, not an async operation, and awaiting it would be
surprising.

As a consequence, **exporting a function named `then` from a proof module is
forbidden**: the module namespace object would become a thenable, corrupting
dynamic `import()` resolution. See
[spec/todo/3240-export.md](../../spec/todo/3240-export.md).

## The two runners, and what sharing them cost

`fjs t` and the browser page run the same proofs through the same core:
`collectTests` walks a tree, `testResult` decides a leaf's identity and status,
and each host supplies only an interpreter and a reporter. That one suite
produces one answer, whichever host runs it, is the property the arrangement
exists for.

It took three attempts, and the second was reverted with every gate green —
`tsc`, 3,547 proofs, 100% coverage, a real Chromium run — for a reason worth
keeping: **the concurrency was the complexity.** Every hard problem that review
fought traces to the traversal fanning out with `all`, and the machinery each
fix added — a frame budget, a guessed 8 ms constant, `scheduler.yield`
selection — is infrastructure a proof runner should not need. The run is
sequential: one leaf's whole chain — test, report, children — completes before
the next leaf starts. The page yields in its own `report` handler, on every
event it reports — so twice per leaf, once so the pending row paints before the
body runs and once so the settled one paints after. That is the browser's
spelling of what a terminal's `write` already is. Speed is not a goal.

### Why the browser runner is `.f.mjs` with a thin host

The browser runner was one impure `.mjs`, so a live host promise and a proof
tree travelled the same code path and the code had to ask *which of these is a
promise?* That is an identity-by-origin question — `instanceof` asks which copy
of the constructor made a value, not what the value is — and asking it where
business logic lives produced ~150 lines of `Symbol.species` machinery, several
rounds of review, two measured ways to hang the suite, and a reversal. The
answer was that the question did not belong there: the runner executes authored
FunctionalScript, which by convention has no promises.

`fjs t` escaped it structurally rather than by being careful. `sandbox` is an
*operation*: the promise is awaited inside the interpreter and the pure core
receives a `SandboxResult`, so the host value never reaches the logic. That is
the discipline `fjs/effects` applies to a live HTTP server, which pure code
holds as a content-hashed handle while the interpreter keeps the object. The
browser now works the same way — `browser/module.f.mjs` is the logic,
`browser/module.mjs` the host — and `instanceof Promise` lives only in
interpreters. See [`todo/plan/capl.md`](../../todo/plan/capl.md) for the general
form, and
[`todo/imports-promises-realms.md`](./todo/imports-promises-realms.md) for what
a promise from another realm would cost, which is a non-goal.

**The question that moved each definition** was not *"does this touch a host
object"* but *"which values does it need from one"*. `reportOf` needed two, so
they are passed in and it is pure. The loading walk needed a module loader, so
that became an *operation* — and naming it is what turned an injected `importer`
parameter into an interpreter's handler. It appeared to need a fan-out as well;
it needed sequencing, which an effect already is.

**Pure logic that reads a *user* value is not impure, it is effectful.**
`errorDetails` and `text` are pure in substance and both need `try`/`catch`,
which FunctionalScript does not have — reading `message` or `stack`, or calling
`String`, runs the value's own code. They are effects over `catch` rather than
thunks in a `try`, which is what let them move.

**The measure, and where it stands.** Count host touches per *definition*, not
definitions per file. In `browser/module.mjs` today, 13 of 14 definitions touch
a host object — a clock, `navigator`, `import()`, a DOM node, `setTimeout`, or
the interpreter loop — and the fourteenth is `runBrowserProofs`, a partial
application of the one above it. Nothing left there is logic that could be
pure. A definition that fails this measure is migration debt: move it, or say
in its JSDoc which host values it needs and why they cannot be passed in.

The size of `browser/proof.mjs` is the standing measurement of how thick the
glue is. It is the largest impure proof file in the repository, and it exists
because a DOM adapter can only be proven against a DOM stand-in; logic proven
there rather than in a co-located `proof.f.mjs` is logic in the wrong file.

### Rules the shared core keeps

These are constraints on future work, not history. They were the terms the two
runners were unified under, and each one is a way the unification can be undone
by accident.

- **The core never asks which host it is running on.** Anything host-specific
  is a part it calls; anything it cannot express through a part is a missing
  extension point, not a special case.
- **Every remaining difference between the runners lives in a part, is
  documented there, and is traceable to something the host forced.** Host APIs
  and wrappers may differ freely; behaviour may differ only for a written
  reason.
- **A fix for a problem either runner has lands in the shared core, or in every
  part at once — in the same change.**
- **Browser modules must not import Node built-ins, the Node effect
  interpreter, `node:test`, or Playwright.** The browser host runner must stay
  usable as native JavaScript, with no bundling or transpilation.
- **Terminal formatting and DOM presentation must not move into the shared
  semantic core.** They are the two hosts' own ends of the same reporter.
- **Both runners produce the same test name for the same leaf.** Nothing about
  a browser prevents it, so a divergence here is the visible sign that the
  semantics underneath were never unified.

### Open questions about the report shape

Three, and they want settling together rather than one at a time — each is
small alone, and answering one without the others is how a report shape ends up
carrying three half-decisions.

1. **Does `path` survive now that `name` exists?**
2. **Should a report declare the root its module keys are relative to?** A name
   embeds a module key, and a module key is relative to the root a run was
   given: `fjs t` invoked in `fjs/types/list` names a leaf
   `import("./proof.f.mjs")…` where the same leaf from the repository root is
   `import("./fjs/types/list/proof.f.mjs")…`. That is `fjs t` differing from
   itself across roots rather than the two runners differing, and it is
   deliberate — a subtree run reports a subtree. But two reports are comparable
   only when their roots agree, and once the browser suite is a gate the
   question is worth settling.
3. **Does a module-level failure belong in a variant of its own?** One that will
   not link is reported as a `TestResult` named by its source, so its totals
   cannot read as "no tests" — which works, and is not obviously the right
   shape.

### The pitfall catalog

Thirteen measured ways this was got wrong, kept because other issues and
several modules cite them by number. The first group is dissolved by the
sequential run; the second applies to **any** implementation and the next
implementer must not rediscover them; the third is about method. Each entry is
a problem the second attempt met, its cause, and the solution that worked.

**Dissolved by sequential:**

1. **The single-task freeze.** Leaves resolve through microtasks, and a
   microtask drain never returns to the event loop, so the whole suite ran as
   one task — measured in Chromium: **54.7 s**, zero paints, the browser
   offering to kill the page. functionalscript#1759's fix was a frame budget in the
   interpreter, which worked (longest task 97–104 ms) and is exactly the
   machinery the sequential plan deletes: one macrotask per report gives a
   task per test with no budget at all.
2. **The reporting burst.** Under `all`, every child starts before any is
   awaited, so each leaf's `report` — a *continuation*, a microtask — queues
   behind the entire suite's execution. Measured: first row in the DOM at
   **44.3 s of a 50 s run**, 90% of 3,461 rows within ~30 ms of each other.
   No budget can fix this — the ordering is the traversal's, and disabling the
   budget left the burst unchanged. `fjs t` has it by construction too.
3. **The variadic `all` ceiling.** Every fan-out is a spread, a spread is a
   call, and a call has an argument limit: 50,000 siblings build, 100,000
   throw `RangeError` **while building the effect**, before any interpreter
   can catch it. Sequential removes every traversal site;
   [all-argument-limit](../effects/todo/all-argument-limit.md) keeps the
   rest.
4. **`batchSize = 25` was doing two unnamed jobs**: its `setTimeout` between
   waves was the page's only macrotask boundary, and awaiting each batch
   bounded how far reporting lagged execution. Nobody chose it for either. (A
   third was claimed during review — staying under the argument ceiling — and
   was a misattribution: `Promise.all(batch.map(…))` passes one iterable, so
   the old runner had no spread at any batch size; the ceiling is item 3's,
   the variadic operation's.) The lesson is not that the constant was right —
   it was indefensible — but that **before deleting unmotivated code,
   enumerate what it does, not what it was for.**

**These survive into any implementation:**

5. **Enumerating is user code; read once.** A getter runs on every read. A
   preflight `collectTests` that only *checked* the tree ran every getter a
   second time, and one that succeeded then threw escaped as a synchronous
   throw — page stuck in `running`, no report, no completion event. The same
   bug recurred one layer down in the same PR: a collision check enumerated
   the interpreter's `extra` map and the construction enumerated it again, so
   a proxy could hide a key from the check and reveal it to the build. The
   rule both times: **read a user value once, and derive everything from that
   one reading.**
6. **The page's modules are a list, not a map.** Routing them through a
   record-shaped `ModuleMap` let `Object.fromEntries` keep only the last of
   two same-labelled modules and report it twice. Two entries with one label
   are two runs, in the order passed.
7. **A run must not start before its promise is published.** A leaf executes
   synchronously inside its handler, so without a deferral the first proofs
   run while `runBrowserProofs` is still building what it returns — a proof
   reading `fjsBrowserTestReport` sees the previous run's promise. Defer
   everything that runs user code (enumeration included) behind one
   `Promise.resolve().then(...)`.
8. **Both ways a run fails as a runner must end in a report.** The error
   channel carries what an operation reported; a *rejection* carries what the
   interpreter could not dispatch at all, and an unhandled one is a page stuck
   in `running` forever. Handle both into the `infrastructure-error` report.
9. **Joins must be linear, and sequential does not grant that for free.**
   Pairwise immutable concatenation was Θ(N²) twice — across siblings, then
   again down a parent/child chain, where "flatten once at the end" recopies
   each subtree once per ancestor and is the same Θ(N²) moved. The fix that
   worked was a rope: joining is one node naming both sides, `toArray` walks
   it once where the run ends. A sequential fold changes execution order, not
   concatenation cost — an immutable `[...acc, r]` append copies the prefix
   every iteration and is the same Θ(N²) — so the port keeps the rope, or
   another accumulator that is demonstrably linear. The rule has since caught
   a third case that had nothing to do with the walk's shape:
   functionalscript#1790 collects each failing leaf so the run can describe
   them all at the end, and that list is threaded through every leaf and joined
   at every module boundary like the totals are. It is a `List` joined with
   `concat` for that reason. Anything a run *accumulates* is subject to this,
   not only the results it walks.
10. **A new exported boundary that its own consumers cast past is not typed.**
    `browserRun` began as `(effect: unknown) => Promise<unknown>` with `any`
    casts at both call sites, and its `extra` was `Partial` — advertising a
    recovery the dispatcher does not perform (it panics on an unclaimed
    command, by design). Make it generic over the effect and its `Result`,
    take a complete map, panic on a handler that claims a core operation
    (silently letting either side win makes the type or the caller a liar),
    and carry handlers by property *descriptor* — `match` looks handlers up
    with `getOwnPropertyDescriptor`, so a spread-merge silently drops a
    non-enumerable handler the layer's dispatch would have accepted.

**Method:**

11. **A proof that observes a coincidence is worse than no proof, because it
    is counted as cover.** A proof that the budget yielded watched for *a*
    macrotask turn during a run; under the full suite a neighbouring proof
    supplies one anyway, so it stayed green with the defect present — sound in
    isolation, inert where the project runs it. Assert by *ordering* (a
    macrotask cannot run until every pending microtask has) or by structure,
    never by observing that the loop turned. And mutation-check under the full
    `npm test`, which is the only run that counts — the inert proof passed its
    own isolated mutation check.
12. **Measure what the user sees, not a proxy for it.** "392 frames served and
    194 progress updates" was reported as "rows painting as they land"; the
    frames were real and dominated by the loading phase, and row count over
    time — the thing a person watches — was never sampled. It read 0 until the
    end. Sample the artifact itself.
13. **When a decision changes, grep the markdown for the old one.** Seven
    review findings on one branch were the same shape: the new answer written
    down with the superseded instruction left standing beside it, handing a
    future implementer two designs. This file is long precisely so it can be
    wrong in one place; keep it saying one thing.

## Proof location and scope

A proof's *location* determines what it can see. Three tiers exist:

| Mechanism | Scope | Runs when | Use for |
|-----------|-------|-----------|---------|
| Module-level `assertEq(...)` | public + private | **every module load** | light, cheap, deterministic checks only |
| `export const proof` co-located in a module | public + private | under the runner | [white-box](https://en.wikipedia.org/wiki/White-box_testing) unit proofs |
| Separate module exporting `proof` | public API only | under the runner | [black-box](https://en.wikipedia.org/wiki/Black-box_testing) / integration |

**Module-level asserts** (e.g. `assertEq(2 + 2, 4)` at the top level of a module)
run on *every import*, not just during a proof run. Restrict them to light, cheap,
deterministic checks — never stress tests or benchmarks, since that cost is paid
on every module load.

**Co-located `export const proof`** shares the module's lexical scope, including
unexported bindings, enabling white-box unit proofs without widening the public
API. Note that `proof` is itself a real export and therefore visible in the
module's public types and runtime bundle; declaring it `unknown`
(`export const proof: unknown = …`) hides the type surface while keeping the
runtime value in place.

**A separate proof module** can reach only the subject module's public exports,
making it suitable for black-box and integration proofs that should not depend on
internal structure.
