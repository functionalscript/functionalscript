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

The three rules above are all **syntactic** — an inline cast, an unknown tag
name, a predicate signature — so none of them needs type information. That
argues for starting with the `fjs` check and reaching for ESLint only if a
type-aware rule turns out to be worth the dependency.

### Do not build a JSDoc type grammar for this

An earlier revision of this issue proposed parsing JSDoc properly: a block
grammar plus a grammar for the subset of TypeScript's type expressions the tree
uses. The second half is a mistake. FunctionalScript's direction is
[`/*: type */` annotations checked by RTTI](./rtti-type-annotations.md), where a
type is an ordinary value and an annotation is an ordinary expression — so a
TypeScript-type grammar would be re-implementing, in the repository's own BNF,
exactly the superset the project exists to avoid.

All three rules are satisfiable without it. The tokenizer keeps a block
comment's body verbatim, so `'* @type {X} '` (JSDoc), `': myType '` (annotation)
and `' plain '` (comment) are told apart by the first character; the rules then
need only the JS token stream around them. That is a recognizer, not a type
parser, and it stays correct when JSDoc goes away.

These rules are therefore **transitional** — they police the JSDoc era and
retire with it. The one thing they do need first is a tokenizer that can read
the tree: it currently accepts neither single-quoted strings nor template
literals, which is tracked in
[rtti-type-annotations.md](./rtti-type-annotations.md).

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
