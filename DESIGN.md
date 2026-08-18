# Design principles

These principles are repository-wide: they govern both code bases — `fjs/`
(FunctionalScript / TypeScript) and `nanvm-lib/` (Rust). The first two are
restated in brief at the top of [AGENTS.md](./AGENTS.md); everything here is
their full text.

## Contents

1. [Simplicity first](#1-simplicity-first)
2. [The API is the most important part of quality](#2-the-api-is-the-most-important-part-of-quality)
3. [Design before implementation](#3-design-before-implementation)
4. [Reuse, DRY, and separation of concerns](#4-reuse-dry-and-separation-of-concerns)
5. [Declarative over imperative](#5-declarative-over-imperative)
6. [Never precompute a size to predict whether something fits](#6-never-precompute-a-size-to-predict-whether-something-fits)
7. [CLI parameters over environment variables](#7-cli-parameters-over-environment-variables)
8. [Embedded DSLs should reuse host-language syntax](#8-embedded-dsls-should-reuse-host-language-syntax)

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
parser) is an acceptable interim answer; a semantic assumption baked into a
format or contract for speed is not.

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
[changelog/README.md](./changelog/README.md#breaking-changes-and-versioning)).
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
defer or silently work around it. File a `todo/` issue with a concrete design
(see [todo/README.md](./todo/README.md)) so it can be reviewed promptly; if the
improvement is in scope for what you're already doing, raise it before building
on top of the weaker design.

## 3. Design before implementation

- Before implementing a non-trivial feature, ensure the corresponding issue
  document in `todo/` contains a concrete design. If the issue exists but the
  design is absent, vague, or contradicts the codebase or runtime behavior,
  update the issue first and wait for review — do not write code against an
  incomplete or incorrect design.
- When a discrepancy is found between an issue's design and reality (a missing
  API, a wrong environment variable, an incompatible type), correct the design
  document and surface the problem rather than silently working around it.
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
- **Avoid side effects and mutability.**

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
