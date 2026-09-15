# Design principles

These principles are repository-wide: they govern both code bases — `fjs/`
(FunctionalScript / TypeScript) and `nanvm-lib/` (Rust). Three are restated in
brief at the top of [AGENTS.md](../AGENTS.md); everything here is their full text.

## Contents

1. [Simplicity first](#1-simplicity-first)
2. [The API is the most important part of quality](#2-the-api-is-the-most-important-part-of-quality)
3. [Design before implementation](#3-design-before-implementation)
4. [Reuse, DRY, and separation of concerns](#4-reuse-dry-and-separation-of-concerns)
5. [Declarative over imperative](#5-declarative-over-imperative)
6. [Never precompute a size to predict whether something fits](#6-never-precompute-a-size-to-predict-whether-something-fits)
7. [CLI parameters over environment variables](#7-cli-parameters-over-environment-variables)
8. [Embedded DSLs should reuse host-language syntax](#8-embedded-dsls-should-reuse-host-language-syntax)
9. [Maximize signal-to-noise](#9-maximize-signal-to-noise)
10. [Refuse what you cannot handle](#10-refuse-what-you-cannot-handle)
11. [Build the replacement beside the module it replaces](#11-build-the-replacement-beside-the-module-it-replaces)

---

## 1. Simplicity first

**Always prefer simplicity and quality over optimization.** Never optimize
prematurely, and especially never at the cost of simplicity. A simple, correct,
generic solution comes first; optimization work starts only after confirming it
is actually needed (a measured problem or a real limit being hit, not a hunch),
and even then it is a **separate task**: file it as its own `todo/` issue instead
of folding it into the current change.

When that task is taken up, still solve the problem in a generic way — improve
the algorithm, the data structure, or the API — instead of hacking special cases
into an otherwise general design (byte-prefix sniffing instead of real parsing,
key-order assumptions, hardcoded fast paths). A documented implementation limit
that a later generic improvement can lift (e.g. a size bound on a buffering
parser) is an acceptable interim answer — provided crossing it is refused rather
than silently mishandled ([§10](#10-refuse-what-you-cannot-handle)); a semantic
assumption baked into a format or contract for speed is not.

## 2. The API is the most important part of quality

**Quality is the main priority, and the API is the most important part of it.**
A clean, readable, simple API for the modules that consume it is worth more than
any existing API's shape. **If the new version can have a better, simpler API,
change it — never hesitate.** An API kept only because something already calls it
is how a codebase ends up with a heap of legacy nobody is allowed to modify, and
every later design is then bent around it. Never cut corners, hack, or bend a
caller's input/output to fit an existing API's shape just to avoid touching that
API.

When the existing design is the obstacle, **fix the design**: rewrite the API and
make a breaking change, updating every importer in the same PR (see
[changelog/README.md](../changelog/README.md#breaking-changes-and-versioning)).
Every consumer inside this repository is visible and updatable, so a hard cutover
is nearly always available — take it. Adjusting a call site to work around a poor
API, instead of improving the API, is the wrong trade-off here.

Keeping the old API alongside the new one is a **last resort**, not the
convenient middle path: two shapes for one concept doubles what a reader has to
understand and, in practice, the old one never leaves. If a rewrite is genuinely
too large for one PR, split it by **scope** — module by module, each step its own
complete breaking change — rather than by **time**. If a transitional API is
still unavoidable, file a `todo/` issue for removing the old one as part of the
same change; the work isn't done until that issue is deleted.

**If you see a way to improve an API — or a new API that would make consuming
modules simpler and more readable — propose it as soon as you notice it.** Don't
defer or silently work around it. File a `todo/` issue — a problem statement
is enough to start, the design can grow later
(see [todo/README.md](../todo/README.md)) — so it can be reviewed promptly; if the
improvement is in scope for what you're already doing, raise it before building
on top of the weaker design.

## 3. Design before implementation

- Design before implementation is an order of work, not a gate. A non-trivial
  feature's design lives in its `todo/` issue, and the issue may be as thin as
  a problem statement. The design grows through
  pull requests — an underspecified issue, then details and ideas, then an
  implementation, with a prototype wherever nobody yet knows — and none of them
  waits on the document being complete. What it owes is direction and
  consistency: a design that contradicts the codebase, the runtime, or another
  issue is corrected rather than built on.
- When a discrepancy is found between an issue's design and reality (a missing
  API, a wrong environment variable, an incompatible type), correct the design
  document and surface the problem rather than silently working around it.
- That holds just as much once implementation is under way and the effort
  already spent is what argues for pushing on. It is not a reason to continue;
  it is what paid for knowing the design is wrong. Prototyping to find out is
  fine — shipping against a design you have already disproved is not.
- Prefer changing a design and implementing it in **separate pull requests**.
  Landed together, only the end state survives, and which parts were decided
  beforehand and which were discovered while building is what a later reader
  cannot recover. A preference, not a rule: where splitting costs more than it
  returns — a one-line correction the code makes obvious — say in the
  description that both are there.
- Before relying on an undocumented or assumed runtime behavior (environment
  variable names, API shape, framework detection), verify it with a small test or
  source check rather than assuming.

## 4. Reuse, DRY, and separation of concerns

- **Reuse code.**
- **Don't Repeat Yourself (DRY)** — a core principle of FunctionalScript, not
  just a stylistic preference. When two or more modules share an algorithm and
  differ only in constants, alphabets, or small helpers, extract a parameterized
  factory into a shared module rather than copy-pasting. Combined with the
  previous point: only extract once the second real consumer exists.
- **Separation of concerns** — move logic to its natural module even with a
  single consumer when the logic is conceptually distinct (e.g. path manipulation
  belongs in `fjs/path`, not inline in a loader). First search for an appropriate
  existing module; create a new one only if no good fit exists. This is different
  from DRY extraction: it is always appropriate.
- **Follow the example** — one skeleton for every context; differences live in
  the parts it calls, and improvements go into the skeleton so everyone gets
  them. See below.
- **Avoid side effects and mutability.**

### Follow the example

When a capability already exists somewhere in the repository and is being
brought to a second context — another host, another backend, another runner —
**the existing one is the specification.**

What is shared is the **skeleton**: the control flow, the order of operations,
the decisions and their names — the shape of the whole thing. Every context runs
that same skeleton. Where a context differs, it differs by supplying a different
**part** that the skeleton calls out to, at a place the skeleton names. It does
not differ by having a skeleton of its own.

So there are exactly two ways to accommodate a context, and both are additive:

- **Adjust that context's part.** A browser writes rows into a DOM where a
  terminal writes lines to stdout; those are two implementations of one named
  part, and the skeleton above them cannot tell which it has.
- **Improve the skeleton, for everyone.** If what the new context needs is
  something the skeleton should have had, put it there. Every context gets it,
  and that is a feature of the change rather than a side effect to apologize
  for.

There is no third way. A branch inside the skeleton that asks which host it is
running on is a fork wearing a shared name, and it is worse than two honest
implementations, because nothing about the shared name signals the difference. A
context that cannot be served by any existing part means the skeleton is missing
an extension point: add the point — one more named part that every context then
supplies — rather than a special case.

The order of work follows from that:

1. **Share the skeleton.** Take the existing implementation as the core, with
   its behaviour unchanged — unchanged *as it stands when the port begins*.
   When an idea lands first in the existing context (the idea-first order
   below), the core the port takes already carries it, and the port copies
   that. Such a port does acquire the new policy, and stays separate from it
   all the same: the policy was argued, landed and proved in its own change,
   in the context that could prove it, so the port's argument is only the
   port.
2. **Adjust the parts** the new context genuinely requires, or extend the
   skeleton so it can express what the new context needs.
3. **Document every difference that remains,** at the part where it is made.
4. **Open an issue for each problem the port revealed,** rather than fixing it
   inside the port.
5. **Solve each issue in the skeleton or in every part at once,** so the
   contexts stay in sync.

The parts worth stating outright:

**Differences are allowed; undocumented differences are not.** The goal is not
one identical behaviour — a browser has no stdout and a terminal has no DOM, and
pretending otherwise invents a host that does not exist. The goal is that every
difference lives in a named part, is deliberate, and is traceable to something
the host forced. "This context could do better here" is not such a reason: that
is an improvement, and an improvement belongs in the skeleton, where everyone
gets it.

**Solve it for every context, or for none.** Once an issue from step 4 is picked
up, the fix lands everywhere in the same change. A fix in one context only is how
the contexts drift back apart, and it hides the finding from the place that has
had the defect longest — usually the older one.

**The example may be simple for a reason.** What looks like a gap from inside
the new context is often a decision made in the old one. Copy it first; if it
turns out to be wrong, it is wrong in both places and worth an issue that says
so.

**Keep the port separate from everything it inspires.** Anything new — a
different scheduling policy, a better measurement, an extra guard — is its own
change, never part of the port. Combined, they cannot be reviewed: an argument
about the new idea becomes an argument about the port. What the rule forbids is
the combination, not a fixed order. The common order is port first, behaviour
unchanged, because the port is usually what reveals the idea. When the idea is
the *premise* — decided before any port, and provable in the existing context
on its own — the same separation runs the other way: land the idea first, in
the context that can prove it, then the port, which then carries no idea of its
own beyond what the shared code already does. (An earlier version of this rule
said "with behaviour unchanged... afterwards", prescribing the order; the
[sequential proof runner](../fjs/emergent_testing/README.md#the-two-runners-and-what-sharing-them-cost)
is the case that showed the order is the consequence, not the rule — porting
first would have moved a context onto semantics about to change under it.)

### Exception to DRY: performance measurement

Time measurement must capture immediately after an operation completes to avoid
measuring the wrapper code itself. This naturally leads to duplication when both
success and error paths must measure. Readability is more important than
eliminating the duplication — keep each measurement explicit and close to its
operation:

```ts
sandbox: async <T>(f: () => T) => {
    let result: Result<T, unknown>
    let after: number
    const before = performance.now()
    try {
        const value = await f()
        after = performance.now()
        result = ok(value)
    } catch (e) {
        after = performance.now()
        result = error(e)
    }
    return { result, duration: after - before }
}
```

Why this pattern is good:

- The two `after = performance.now()` calls are necessary on the critical path —
  extracting them into a helper would measure the helper function's overhead
  instead of just the operation.
- TypeScript tracks uninitialized values: declaring `let after: number` without
  initialization lets the type checker verify that `after` is assigned in all
  code paths before the final `return` statement.
- We still avoid duplication of non-critical computations: the return value of
  the function (`{ result, duration: after - before }`) is formed once, not
  duplicated. Only the timing capture (which must be immediate) appears twice.

## 5. Declarative over imperative

**Prefer declarative style over imperative.** When defining tools, handlers,
dispatchers, or similar abstractions, favor data-driven definitions (metadata +
schema + handler together in an array or registry) over imperative switch
statements or hardcoded conditionals. Declarative patterns are easier to extend,
test, and reason about. For example: define tools as an array of
self-descriptive objects (name, description, schema, handler) and dispatch
generically over them, rather than hardcoding a switch on tool name.

## 6. Never precompute a size to predict whether something fits

**Never precompute or estimate an encoding/decoding size to predict whether it
will fit a limit.** Attempt the real decode/encode and branch on its result
instead. Size estimates (string-length lower bounds, base64's 3/4 ratio,
JSON-escaping multipliers, …) are easy to get subtly wrong — and a
wrong-in-the-unsafe-direction estimate reintroduces the exact crash the check was
meant to prevent — while the real operation is always exactly right.

Express the fallible operation as a `try*` function returning `Nullable<T>` (see
`tryUtf8`, `tryListToVec`, `tryU8ListToVec`, `base64Decode` in `fjs/text`,
`fjs/types/bit_vec`, `fjs/base64`), add a new `try*` variant if one doesn't exist
yet for the operation you need (including effect primitives like `write`), and
have the caller check the `null` result rather than a precomputed bound.

## 7. CLI parameters over environment variables

CLI parameters are preferred over environment variables when adding new
features.

## 8. Embedded DSLs should reuse host-language syntax

**An embedded DSL should reuse JavaScript / FunctionalScript values and syntax
whenever their existing meaning is exactly the meaning the DSL needs.** Prefer
ordinary numbers, strings, arrays, and objects over wrapping the same information
in tagged syntax. For example, prefer `3.14`, `'abc'`, `[1, 2]`, and `{ x: 1 }`
over representations such as `['number', 3.14]` or an object/array tag whose only
purpose is to say what the host value already says.

Introduce a constructor, function, tag, or other DSL-specific form only for a
concept the host language cannot express directly and unambiguously. RTTI follows
this pattern: constants can describe themselves, while constructions such as
`array(number)` need DSL syntax because an array *value* and the type "array of
numbers" are different concepts. The proposed NaNVM operator-test data eDSL applies the same principle: ordinary
operands and expected results should be ordinary JavaScript values, while
references, function values, and expected throws need special forms.

Do not expose a tagged-union representation as the authoring API merely because it is
convenient for the implementation. The ergonomic eDSL and its normalized
machine-oriented representation may be different layers: a parser/compiler may
normalize an author-friendly value into explicit tagged nodes for pattern
matching, serialization, hashing, or code generation. Prefer the simplest representation that preserves the required semantics. Avoid
redundant DSL syntax: less representational noise benefits people, AI systems,
deterministic computation, hashing, serialization, storage, and code generation
alike. Use a more explicit normalized representation only when that extra
structure provides actual semantic or processing value.

Apply this principle to new eDSLs and when improving existing ones, including the
future FunctionalScript function EDAG. That EDAG should reuse FunctionalScript's
own literals, arrays, objects, and other language constructions wherever their
meaning coincides with the syntax being represented, and introduce explicit EDAG
nodes only where the host-language value would be ambiguous or insufficient.

## 9. Maximize signal-to-noise

**Make the high-level abstraction and structure obvious.** Every contribution —
code, APIs, documentation, `todo/` issues, PR descriptions, comments, and tests —
should expose the main concepts first. Put details, caveats, examples, and edge
cases at the leaves, not in the main flow.

**More information is not automatically better.** Remove repetition, obvious
narration, unnecessary wrappers, redundant examples, and implementation trivia.
Use clear names and structure so readers can understand the shape of a solution
without reading every detail.

**Optimize for progressive understanding:** abstraction first, structure second,
details last.

## 10. Refuse what you cannot handle

**An input the code does not support is refused, never approximated.** When an
operation meets a case it cannot handle correctly — a size past the limit it
implements, a shape the parser does not cover, a combination the design left
out — it has to say so at the boundary. Returning something plausible and wrong
is the one outcome that is never acceptable: it passes every test that only
checks for the absence of a failure, and by the time somebody notices, the
wrong answer sits in a file nobody can tell apart from the right ones. A crash
is a bug report with a stack trace; silent corruption is a bug that first has
to be discovered.

There are two ways to refuse, and the choice between them is the one drawn in
[fjs/AGENTS.md
§1.5](../fjs/AGENTS.md#15-never-use-trycatch-test-throwing-with-the-throw-key):

- **Reject** when the input is one a caller may legitimately hand over and is
  expected to handle — an oversized buffer, a malformed document, a name that
  does not resolve. Express it as a `try*` function returning `Nullable<T>` (or
  a `Result`) and let the caller branch on it, as in
  [§6](#6-never-precompute-a-size-to-predict-whether-something-fits).
- **Panic** — `throw` in FunctionalScript, `panic!` in Rust, an assert at the
  entry of the operation — when the input violates something the caller was
  supposed to guarantee, so there is nothing sensible for it to do with a
  `null` anyway.

Where the line falls follows from where validation happens. A value is
validated once, where it enters from IO — a file, a socket, a command line —
and is trusted from then on. Inside, an assert that fires means a bug, not a bad
input, and crashing there is better than continuing: the caller was supposed to
have validated, and a program that goes on past a broken assumption produces
the silent corruption this section exists to prevent. So a `try*` belongs at
the boundary, and an assert is the right answer inside it — an asserting API is
not unusable, it is used after prevalidation. That is not a reason to assert
everything: an assert guards an assumption the code would otherwise answer
wrongly on, and one that guards nothing the code relies on is noise
([§9](#9-maximize-signal-to-noise)).

A documented implementation limit ([§1](#1-simplicity-first)) is acceptable only
under this rule: the limit has to be enforced where it is crossed. "Handles up
to 128 KB" is a limit when the 129th kilobyte is refused, and a latent
corruption when it is truncated, wrapped, or quietly mis-encoded.

Refusing is the **mitigation**, not the resolution. The order is: refuse now —
a check and a `throw` is minutes of work and stops the wrong answers today —
then file the `todo/`, then fix it. That order makes the real fix schedulable
instead of urgent, because nothing is being corrupted while it is designed. The
exception is the limit meant to stay: a bound chosen on purpose is part of the
API, documented where the API is, and needs no issue. Say which of the two it
is — "we refuse this for now" and "we refuse this by design" read identically
at the call site.

## 11. Build the replacement beside the module it replaces

**When a module's design is the obstacle and the rewrite is too large for
one PR, build the new module beside the old one, move the consumers one at a
time, and delete the old module last.** This is [§2](#2-the-api-is-the-most-important-part-of-quality)'s
split by scope for the case where the scope is a whole module: each
consumer's move is one complete cutover, the old module stays live until
the last one, and nobody's unrelated work waits on the rewrite.

1. **Create the new module beside the old one.** A new name, not a rename:
   nothing under the old path moves, so nothing that imports it changes.
2. **Write the code there, cherry-picking from the old module what is worth
   keeping and rethinking the rest.** Triage every piece before touching it
   — *move*, *rewrite* or *retire* — and revise the triage as the work
   teaches, recording each revision where the triage is. A move means the
   behaviour is worth keeping, not that the code is.
3. **The old module may depend on the new one, never the other way round.**
   In any code form — a runtime import, a JSDoc `@import`, an `import type`
   — since a type-only edge is exactly what fails the type checker once the
   old module is deleted. A link from a document is a reference, not a
   dependency: it does not have to hold, but it rots the same way, so name
   what will survive. The rule is held by review, and its mechanical check
   is the deletion itself, which compiles or does not.
4. **Keep the old module open for use and improvement; block nobody.** The
   two modules are not kept in sync. A feature added to the old one is
   ported when a consumer that needs it moves, as part of that consumer's
   port, so the porting cost is paid once, by the port that proves the
   feature is still wanted; keep the modules similar enough in shape that
   such a port is routine. What no port reaches is garbage, collected when
   the old module is deleted — a reachability walk over the old module with
   the consumers as roots, and nobody has to decide to drop anything.
5. **Move the consumers one by one**, each port carrying the features it
   needs and declaring its own breaking changes where the consumer's surface
   changes.
6. **Delete the old module**, with the issues that described only its code,
   and repoint every reference — links and prose — to what replaced its
   target. One `**BREAKING CHANGES:**` declaration, for the old paths that
   were public.

### The worked example: `fjs/ebnf` replacing `fjs/bnf`

`fjs/bnf` was a grammar toolkit: a functional front end without a
repetition primitive, a packed 24-bit terminal, and two backends, one of
them backtracking. [`fjs/ebnf`](../fjs/ebnf/README.md) replaced it — a front
end with `repeat(min, max)`, range-set terminals, one LL(1) backend folding a
rewrite set into the parse, and the alphabets and grammars above it. The
consumers were the `fjs/djs` tokenizer and parser. The plan was
`fjs/todo/ebnf-migration.md`, deleted when the migration finished, and this
section is its record. What it taught:

- **The direction rule cost nothing to hold and needed no tool.** No
  `ebnf → bnf` edge was ever written, and the deletion compiled first try.
  The rule does not reach documents, and the plan's wish that `ebnf/`
  documents name `bnf/` issues rather than link them did not hold: the
  commit before the deletion, four `ebnf/` documents held nine links into
  `bnf/todo/`, and the names in prose had gone stale besides, where no
  link checker reads. The deletion had to sweep prose as well as links,
  and one sentence still escaped it into review.
- **Most moves became rewrites, and the triage said so as it went.** Of the
  modules first binned as moves, only `token_symbol/` moved. The shared
  matcher layer retired because the new backend did not need one; the
  separate AST rewrite shipped and was then retired by the fold that
  replaced it; the AST printer retired because the proofs pinned trees as
  data. What crossed was names and shape — `data/`, `ll1/`, `token_symbol/`,
  `lib/` — and almost no code. Each revision was written into the plan's
  tables as **Amended**, which is what let the plan stay true while the work
  diverged from it.
- **The garbage collection worked.** The backtracking backend, the runtime
  check of a mapping's declared input, the test library, the lowering that
  recognized repetition by shape: none was ported, because no consumer's
  port reached it, and none needed a decision.
- **The comparison that mattered was of the consumers' grammars, not of the
  front ends.** The planned side-by-side proofs — one grammar in both
  spellings, lowered to the same set — were never written; the classical
  front end was gone before they were worth their cost. What found the
  problems was measuring the old grammars against the new backend's
  refusals: bridged into the new form, the two djs grammars refused in eight
  shapes, each a place where the backtracking backend had been deciding by
  trial. So each port was a grammar rewrite plus a backend swap, not a swap
  alone; the eight are recorded in
  [`fjs/fsc/README.md`](../fjs/fsc/README.md#both-grammars-are-ll1).
- **A stricter backend can change the language.** One of the eight was the
  parser's statement terminator, and resolving it made `;` required after
  every statement — a change to what DJS accepts, not to any `bnf/` path.
  The port declared it as its own breaking change, as step 5 requires; the
  migration's one declaration covered only the deletion.
- **The stages were dependencies, not a sequence.** The byte alphabet landed
  for a Git consumer ahead of the text adapter it was planned beside; the
  backend shipped before the terminal module it was to build on; the plan
  said so from the start, "numbered for reference, not for order", and
  nothing waited on a stage that had not shipped. Two pieces of its layout
  are still open, as ordinary issues rather than stages —
  [`ebnf/terminal/`](../fjs/ebnf/todo/symbol-domain-owner.md) and
  [`ebnf/unicode/`](../fjs/ebnf/unicode/todo/unicode-rules.md) — and their
  being open did not keep the old module alive.
