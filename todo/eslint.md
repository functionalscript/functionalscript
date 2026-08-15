# ESLint (or an `fjs` equivalent) for rules `tsc` cannot express

**Priority:** P3
**Status:** open

### Problem

The repository has no linter. Everything is enforced either by `npx tsc` or by
review against [AGENTS.md](../fjs/AGENTS.md). That leaves a class of rules with
no mechanical enforcement at all, and the cast audit made the cost visible.

Three concrete gaps:

1. **Inline `/** @type {T} */ (expr)` casts.** AGENTS.md asks for an annotated
   declaration, `@satisfies`, or `assert*` instead. TypeScript has no option to
   ban `as` or its JSDoc equivalent, so the count only moves when a human
   notices. [inline-type-casts.md](./inline-type-casts.md) found 357 of them,
   208 of which need no cast at all. Without a check they creep back after the
   cleanup.

2. **Misspelled JSDoc tags are silently ignored.** This compiles clean:

   ```js
   /** @tpye {string} */
   export const h = 1

   export const i = /** @tpye {string} */ (1)
   ```

   Neither annotation exists as far as the compiler is concerned, and nothing
   reports it. This is the one place where JSDoc-on-`.mjs` is genuinely weaker
   than authored TypeScript — in a `.ts` file the annotation is syntax, so a
   typo is a parse error. A rule that rejects unknown tags in `/** … */` blocks
   would close it.

3. **Type predicates and other AGENTS.md prohibitions.** "Avoid type
   predicates", "avoid `as`", the `@type {const}` placement rule — all currently
   review-only.

### Two ways to do it

**ESLint.** `eslint` + `@typescript-eslint` gives `no-unnecessary-type-assertion`
(which would have found much of the audit's "remove" bucket automatically),
`no-explicit-any`, `consistent-type-assertions`, and a plugin surface for the
custom rules above. The cost is real: the repo currently has exactly two
devDependencies (`typescript`, `@types/node`) and no other JavaScript tooling.
ESLint plus a TypeScript parser is a large dependency tree, needs its own config
and CI step, and its typed rules re-run the type checker.

**An `fjs` check.** FunctionalScript already has its own tokenizer, parser and
CLI (`fjs/js/tokenizer/`, `fjs/djs/`, `fjs/module.f.mjs`). A `fjs lint`
subcommand reading the same token stream would add no dependency, would exercise
the compiler on the repository itself, and fits the self-hosting direction. It
is more work up front, and it will not reach parity with
`@typescript-eslint`'s type-aware rules without type information.

[jsdoc-parser.md](./jsdoc-parser.md) works this option out in detail. Doing it
properly means parsing JSDoc rather than pattern-matching comment text — a block
grammar and a TypeScript-type-subset grammar, both in `fjs/bnf` form, sized to
the surface the repository actually writes. That doc also records the blocker:
the JS tokenizer accepts neither single-quoted strings nor template literals, so
it cannot yet read the code it was written to describe.

The three rules above are all **syntactic** — an inline cast, an unknown tag
name, a predicate signature — so none of them needs type information. That
argues for starting with the `fjs` check and reaching for ESLint only if a
type-aware rule turns out to be worth the dependency.

### Proposal

1. Decide between the two directions above; this is a policy call about
   dependencies, not a technical blocker.
2. Whichever is chosen, land the three syntactic rules first — inline `@type`
   cast, unknown JSDoc tag, type predicate — since they are what AGENTS.md
   already forbids and nothing checks.
3. Wire it into CI next to `npx tsc` and `fjs t`.
4. Gate the cast rule behind an allowlist or a warning level until
   [inline-type-casts.md](./inline-type-casts.md) is worked through, so the
   cleanup and the enforcement can land independently.

### Related

- [inline-type-casts.md](./inline-type-casts.md) — the 357 sites this would keep
  from regressing.
- [tsconfig-strict-flags.md](./tsconfig-strict-flags.md) — what `tsc` *can*
  enforce, and at what cost.
