## ESLint for rules `tsc` cannot express

**Priority:** P2
**Status:** open

### Problem

The repository has no linter. Everything is enforced either by `tsc` or by
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

### ESLint is the near-term answer

`eslint` + `typescript-eslint` gives `no-unnecessary-type-assertion` — which
would have found most of the audit's 181-cast "remove" bucket on its own —
plus `no-unnecessary-condition`, `no-explicit-any`,
`consistent-type-assertions`, and a plugin surface for the three rules above.

The cost is real and should be stated plainly: the repository has exactly one
devDependency (`@types/node`) and no other JavaScript tooling — even the
compiler comes from the environment rather than from `npm ci`.
ESLint with a TypeScript parser is a large dependency tree, needs its own
config and CI step, and its typed rules re-run the type checker.

It is still worth it, because it is the only entry in
[strict-static-analysis.md](./strict-static-analysis.md) that reaches
**type-aware** rules. Everything else there — `tsc` flags, `deno lint`,
`deno fmt`, `knip`, `publint` — is syntactic or structural. The single most
valuable rule found by the cast audit needs the checker, and nothing but
`typescript-eslint` provides it.

### The `fjs lint` alternative, and why it waits

FunctionalScript has its own tokenizer, parser and CLI, so a `fjs lint`
subcommand could carry the three syntactic rules with no dependency at all, and
would exercise the compiler on the repository itself. That is the right
long-term home for them.

It is not the near-term answer, for two reasons. FunctionalScript's string
grammar is JSON's — double quotes only, by design
([`spec/todo/2460-js-string-literals.md`](../spec/todo/2460-js-string-literals.md)) — so the
tokenizer does not accept the single-quoted, template-literal `.mjs` sources
this repository is currently written in, and a linter built on it could not
read the code it is meant to check until those sources are normalized. And the
rules it would carry are the ones ESLint would carry anyway. Deferring it costs
nothing; deferring ESLint leaves the type-aware rules unrun.

### Whichever route: do not build a JSDoc type grammar

An earlier revision of this issue proposed parsing JSDoc properly: a block
grammar plus a grammar for the subset of TypeScript's type expressions the tree
uses. The second half is a mistake. FunctionalScript's direction is
[`/*: type */` annotations checked by RTTI](../spec/todo/3360-type-annotations.md), where a
type is an ordinary value and an annotation is an ordinary expression — so a
TypeScript-type grammar would be re-implementing, in the repository's own BNF,
exactly the superset the project exists to avoid.

All three rules are satisfiable without it. The tokenizer keeps a block
comment's body verbatim, so `'* @type {X} '` (JSDoc), `': myType '` (annotation)
and `' plain '` (comment) are told apart by the first character; the rules then
need only the JS token stream around them. That is a recognizer, not a type
parser, and it stays correct when JSDoc goes away.

These rules are **transitional** in the sense that they police the JSDoc era —
but that era is the whole of the foreseeable future, since `/*: type */` waits
on the compiler. They are worth writing now.

### Proposal

1. Decide whether the dependency is acceptable. This is a policy call, not a
   technical blocker, and it is the only thing standing in the way.
2. Land `eslint` + `typescript-eslint` with the recommended type-aware set,
   starting from `no-unnecessary-type-assertion`.
3. Add the three custom rules — inline `@type` cast, unknown JSDoc tag, type
   predicate — since they are what AGENTS.md already forbids and nothing checks.
4. Add it to the generated workflow via `fjs/ci/` (not to `ci.yml` directly),
   next to `tsc` and `fjs test`.
5. Gate the cast rule behind an allowlist or a warning level until
   [inline-type-casts.md](./inline-type-casts.md) is worked through, so the
   cleanup and the enforcement can land independently.

### Related

- [inline-type-casts.md](./inline-type-casts.md) — the 357 sites this would keep
  from regressing.
- [tsconfig-strict-flags.md](./tsconfig-strict-flags.md) — what `tsc` *can*
  enforce, and at what cost.
- [strict-static-analysis.md](./strict-static-analysis.md) — the umbrella: every
  standard tool that could check this code base, and where ESLint sits among
  them.
- [`spec/todo/3360-type-annotations.md`](../spec/todo/3360-type-annotations.md) —
  the eventual type layer, gated on the compiler; it does not change what to do
  now.
