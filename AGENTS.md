# AGENT Instructions

This repository contains both Node.js (TypeScript) and Rust code. Check the [./issues/README.md](./issues/README.md) file for existing issues.

## Requirements

- Use **Node.js 24 or later**.
- Install Node dependencies with `npm ci`.
- Install Rust dependencies with `cargo fetch`.

If either installation fails, skip all test commands.

## Update

It's recommended to run `npm run update` after changing the source code.

## Testing

- Run `npx tsc` to type-check using the repository's version of TypeScript.
- Run `npm test` to test FunctionalScript (`.f.ts`) files with Node 22+.
- Run `cargo test` to test the Rust crate in `nanvm-lib`.
- Run `cargo clippy` to lint the Rust crate.
- Run `cargo fmt -- --check` to verify formatting.
- To run only the tests under a specific directory, `cd` into it and run `npm run fst`. This scans for `test.f.ts` files in that subtree and reports per-test results.

## Documentation

Use JSDoc for documenting TypeScript files. Every module should start with this header:

```ts
/**
 * <...Module documentation...>
 *
 * @module
 */
```

where `<...Module documentation...>` should be documentation for the module.

## Design and Implementation

- Before implementing a non-trivial feature, ensure the corresponding issue document in `./issues/` contains a concrete design. If the issue exists but the design is absent, vague, or contradicts the codebase or runtime behaviour, update the issue first and wait for review — do not write code against an incomplete or incorrect design.
- When a discrepancy is found between an issue's design and reality (a missing API, a wrong environment variable, an incompatible type), correct the design document and surface the problem rather than silently working around it.
- Before relying on an undocumented or assumed runtime behaviour (environment variable names, API shape, framework detection), verify it with a small test or source check rather than assuming.

## Pull Requests

- The PR should implement only one feature/improvement with minimal code changes.
- Don't implement a feature, helper, or module that no existing module uses and no near-term work plans to use. Speculative code rots, drags type-checking and test budgets, and pushes future readers to wonder what it's for. If the same algorithm appears in only one place, leave it there until a second call site forces the abstraction.
- Principles:
  - Reuse code,
  - Don't Repeat Yourself (DRY) — a core principle of FunctionalScript, not just a stylistic preference. When two or more modules share an algorithm and differ only in constants, alphabets, or small helpers, extract a parameterized factory into a shared module rather than copy-pasting. Combined with the previous bullet: only extract once the second real consumer exists.
    - **Exception: Performance measurement.** Time measurement must capture immediately after an operation completes to avoid measuring the wrapper code itself. This naturally leads to duplication when both success and error paths must measure. Readability is more important than eliminating the duplication — keep each measurement explicit and close to its operation:
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
      - The two `after = performance.now()` calls are necessary on the critical path — extracting them into a helper would measure the helper function's overhead instead of just the operation.
      - TypeScript tracks uninitialized values: declaring `let after: number` without initialization lets the type checker verify that `after` is assigned in all code paths before the final `return` statement.
      - We still avoid duplication of non-critical computations: the `result` object is formed once, not duplicated. Only the timing capture (which must be immediate) appears twice.
  - Separation of concerns — move logic to its natural module even with a single consumer when the logic is conceptually distinct (e.g. path manipulation belongs in `fs/path`, not inline in a loader). First search for an appropriate existing module; create a new one only if no good fit exists. This is different from DRY extraction: it is always appropriate.
  - Avoid side effects and mutability.
- When a sibling module already has the type or helper you need, import it — add `export` to the existing declaration if it's not yet exported, rather than duplicating it (e.g. `parse` reuses `Path`, `ValidationError`, `verror`, `prependPath`, `primitive0Validate`, `constPrimitiveValidate` from `validate`).
- Don't mutate arrays, sets, maps, or objects in place. Avoid `.push`, `.pop`, `.shift`, `.unshift`, `.splice`, `.sort`, `.reverse`, `Set#add`, `Set#delete`, `Map#set`, `Map#delete`, and index/property assignment on accumulators. Build new values with `.map`, `.filter`, `.flatMap`, spread, `new Set([...prev, x])`, `new Map([...prev, [k, v]])`, and `Object.fromEntries(entries.map(...))`.
- Hoist helpers (functions, types, constants) to module scope when they don't capture local state — don't redeclare them inside another function on every call. If a `reduce`/`map` callback needs context that varies per call, thread it through the accumulator rather than closing over a local, so the step function itself can live at module scope.
- Hoist call-invariant computations out of function bodies. If a sub-expression does not depend on a function's parameters, evaluate it once in the enclosing scope and capture the result instead of recomputing it on every call. This includes property accesses and destructuring of a module-level value: prefer `const { listToVec } = msb` at module scope and call `listToVec(x)` over calling `msb.listToVec(x)` inside a per-call function.
- When adding a new `module.f.ts` under an existing namespace, register it in the `exports` map of `deno.json`.
- Issues are tracked in `./issues/`, not on GitHub. To file a new issue: create `./issues/YMD-{slug}.md` where `YMD` is the current date encoded as three Crockford base32 digits (Y = year offset from 2020, M = month, D = day — see `./issues/README.md` for the encoding table). Use a short kebab-case slug. Do not add an entry to `./issues/README.md` — the directory itself is the index. Do not open GitHub issues.
- After fixing an issue, mark it **Status: done** in its file. Before marking done, ensure design decisions are captured in the codebase: architectural choices and *why this / why not that* rationale belong in the relevant `README.md` files; API shape and invariants belong in JSDoc on the affected `module.f.ts` exports. Record the decision in the commit message if it was a "will not fix". Done issues are deleted occasionally in a separate cleanup pass — do not delete them immediately after fixing.
- Reference issues with the `i` prefix as an explicit link, not GitHub's `#` prefix. `#NNN` is reserved for GitHub PR/issue numbers; `iYMD-slug` refers to a file in `./issues/`. Always render the reference as a markdown link pointing to the file, e.g. [i65X-sandbox](./issues/65X-sandbox.md).
- To add a CHANGELOG entry, first open the PR to obtain its number, then add the entry at the **top** of `## Unreleased` in [./CHANGELOG.md](./CHANGELOG.md) using the real PR number. Follow the same `Topic: short description [NNN](url)` style as existing entries; the link must point to the pull request (`/pull/NNN`), not to an issue. Do not reference issue files in CHANGELOG entries — issue files are deleted when done, so those links rot. New entries always go above existing ones. Do not commit the CHANGELOG change — leave it unstaged for the author to review. Only add CHANGELOG entries for code changes — PRs that only touch `issues/`, `AGENTS.md`, or other documentation files do not need a CHANGELOG entry.
- When the version is bumped in `deno.json`/`package.json`, create a new `## X.Y.Z` section in `CHANGELOG.md` immediately after `## Unreleased` and move all entries from `## Unreleased` into it, leaving `## Unreleased` empty.
- Only import other `.f.ts` files from FunctionalScript modules. Avoid references to built-in or external Node modules such as `node:path` in `.f.ts` files.
- Prefer `.flatMap(e => e !== undefined ? [e] : [])` over `.filter((e): e is T => e !== undefined)` to remove `undefined` entries from an array. Type predicates in `filter` are error-prone: if the element type changes, the predicate silently becomes wrong. `flatMap` narrows correctly without a manual type annotation.
- Avoid TypeScript type predicates (`(x: T): x is U`). They are error-prone: the compiler trusts the annotation unconditionally, so if the runtime check diverges from the declared type the error is silent. Use `instanceof` for class/constructor discrimination, or restructure the union so a structural check (e.g. `instanceof Array`) narrows correctly without a predicate.
- Avoid `as` type assertions (except `as const`). They silence the type checker and hide real bugs — if a cast is needed, it usually means the types or the code structure should be improved instead.
- Avoid `macro_rules!` in Rust code. Declarative macros hide types from rust-analyzer, break grep and jump-to-definition, and encourage "invisible code" that contradicts FunctionalScript's preference for explicit, locally-readable values. When per-type trait boilerplate looks like a macro candidate (e.g. one impl block per nominal newtype, byte-identical modulo names), prefer in this order: (1) a sealed helper trait carrying the variant choice with one-line per-type impls and a single blanket `impl<T: Trait>` deriving the boilerplate; (2) a `build.rs` code generator driven from a small source-of-truth table written in plain Rust (or a FunctionalScript module if the same table drives other artifacts too); (3) accept the hand-written duplication as the cost of readability. Reach for `macro_rules!` only when no other option is materially better for readers.
- Use `let` variables only within the function body where they are declared.
- Don't vertically align code with padding spaces (e.g. extra spaces before `:` / `=` to line up values across rows). It churns on every edit and makes `git blame` noisy. Write `'actions/checkout': 'v5',` not `'actions/checkout':                          'v5',`. Vertical alignment is fine in markdown, documentation, and comments.
- When two code branches share most of their structure, refactor so the shared part appears once and only the difference lives in the conditional. Forcing the reader to mentally diff two near-identical blocks is a readability cost, not just a DRY violation. Prefer `{ ...shared, ...(cond ? { extra } : {}) }` over two object literals that repeat every field, and `cond ? a : b` over duplicated `if`/`return` arms whose bodies only differ in one expression. Hoist call-invariant computations above the branch so the conditional contains only what actually varies.
- CLI parameters are preferred over environment variables when adding new features.
- Ensure all of the above tests pass before submitting changes.
