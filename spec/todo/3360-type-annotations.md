# Type Annotations

```js
import { number, or, string } from 'functionalscript/fjs/rtti/module.f.mjs'

export const myType = or(number, string)

export const a /*: myType */ = 'hello'
```

An annotation is a comment holding the **name** of an RTTI schema. The compiler
loads that name's value at compile time and checks the annotated value against
it.

> **Narrowed by the epic.** This document was written with the annotation body
> as an ordinary *expression* handed to the expression parser, and the rest of
> it below still reads that way.
> [rtti-type-system](../../todo/rtti-type-system.md) narrows the body to a
> single identifier bound by a `const` or an `import`: no call, no member
> access, no operator, no literal. Anything more is written as an ordinary
> `const` first and annotated by its name. A comment that can hold a call can
> hold a sub-language, which is the road back to a type grammar; a bare name
> has no scoping, evaluation order, or error messages of its own, and it makes
> recognition one token rather than a parse. Reconciling the text below with
> that rule is stage 2 of the epic — including the two consequences it has:
> [expression](./3410-expression.md) is no longer a dependency of the
> annotation body, and whether a dotted `ns.myType`
> ([namespace-import](./2220-namespace-import.md)) counts as a name is open.

**Evaluating and checking an annotation** depends on the compiler being able to
load and run a module as meta-programming
([`fjs/fsc/todo/047-fsc-meta-programming.md`](../../fjs/fsc/todo/047-fsc-meta-programming.md)). Recognizing one does not:
settling the annotation's form, matching the comment, and resolving its single
identifier against the module's bindings need neither meta-programming nor the
expression parser, and are stages 2–3 of
[rtti-type-system](../../todo/rtti-type-system.md) — which they can start
without. This is a working draft of a direction, not a plan: TypeScript
remains the type checker meanwhile, and the near-term work is to turn the
standard toolchain up as far as it goes
([`todo/strict-static-analysis.md`](../../todo/strict-static-analysis.md)).

Not to be confused with the TC39
[Type Annotations](https://github.com/tc39/proposal-type-annotations) proposal
(§4.1), which is erasable syntax with no checker attached. This feature is the
opposite: no new syntax beyond a comment, and a checker that is an ordinary
library.

## Why not a type language

TypeScript's answer to typing is a superset of JavaScript with its own type
grammar. JSDoc's answer is the same grammar again, only noisier. Neither is
wanted here: a type should be an ordinary **value**, built from
[`fjs/rtti`](../../fjs/rtti/README.md), and an annotation should be
an ordinary **expression** naming one.

`.d.ts` can be generated from the same schemas, and inference should carry as
much of the burden as possible so annotations stay rare. `/*: … */` and JSDoc's
`/** … */` coexist while the tree migrates.

## What this settles about the parser

There is no type grammar to write. A JSDoc-shaped design would need one — a
block grammar, and underneath it a grammar for a subset of TypeScript's type
expressions — and that second layer is the superset this project exists to
avoid, re-implemented in the repository's own BNF. The annotation body is a
name in the module's own scope. What is needed is only a way to recognize the
annotation and resolve that one identifier against the module's bindings — not
even the expression parser is involved, once the body is narrowed to a name as
above.

That recognition is nearly free today. The tokenizer keeps a block comment's
body verbatim, so the three forms differ in their first character:

```js
// export const a /*: myType */ = "hello"
{ kind: '/*', value: ': myType ' }     // annotation
{ kind: '/*', value: '* @type {X} ' }  // JSDoc
{ kind: '/*', value: ' plain ' }       // comment
```

which is exactly why the two annotation forms can coexist during the
transition. A distinct token kind would be cleaner than inspecting the first
character, but no new grammar is involved either way.

## What already exists

More than half of this is built:

| Piece | Where | State |
| --- | --- | --- |
| Schema constructors | `fjs/rtti/module.f.mjs` | `boolean`, `number`, `string`, `bigint`, `unknown`, `array`, `record`, `or`, `option`, `never`, plus `Const` (primitive / tuple / struct used directly as its own schema) |
| Value checking | `fjs/rtti/parse/` | `parse(schema)(value)` |
| Canonical data form | `fjs/rtti/data/` | `toData`, `cmp`, `equal`, **`subset`**, data-driven `validate` |
| TypeScript emission | `fjs/rtti/ts/module.f.mjs` | runtime printer: `thunk RTTI → toData → dataToTs`, emitting canonical type aliases, recursion included |
| Compile-time bridge | `Ts<T>` in `fjs/rtti/ts/types.ts` | maps a schema to its TypeScript type, so `tsc` keeps working through the transition |

Two of these matter more than they look. `data`'s **`subset`** is assignability
as a decidable operation on the canonical form — the primitive a checker needs.
And `ts/module.f.mjs` is already the `.d.ts` generator: schemas in, canonical
TypeScript aliases out.

## Open questions

1. **Compile-time evaluation and staging.** Checking `a /*: myType */` requires
   evaluating `myType`, which requires evaluating its imports. Which expressions
   may an annotation reference — module-level constants only, or anything the
   compiler can reduce? What happens when an annotation depends on a value that
   is not compile-time known?

2. **Non-literal right-hand sides.** `validate(myType)('hello')` settles the
   literal case. For `const a /*: t */ = f(x)` the checker must infer an RTTI
   for `f(x)` and ask `subset(inferred, declared)`. `subset` exists; the
   inference does not. This is where "more type inference" has to land, and it
   is most of the work.

3. **Function types.** `Type` has no function case, and FunctionalScript modules
   are almost entirely functions — **nearly half** the tree's JSDoc type bodies
   are function types (~46% when measured in review of #1719; counts drift, so
   re-measure rather than cite this). The schema side is tracked as
   [`fjs/rtti/todo/668-rtti-function-types.md`](../../fjs/rtti/todo/668-rtti-function-types.md).

   > **Superseded by the epic.** An earlier draft here posed the annotation
   > question as a choice between "a compile-time check that cannot be
   > completed" and "a wrapper that validates each call", reading 668's runtime
   > limitation as the general case. That framing is retired by
   > [rtti-type-system](../../todo/rtti-type-system.md) stage 7, which splits by
   > **provenance** instead: a function whose definition the compiler can read
   > is statically checkable with no wrapper and no API change — check the
   > body's inferred result against the declared result schema, and each visible
   > call site against the parameter schemas — while 668's `Result`-returning
   > wrapper is for an *opaque* function crossing a runtime boundary, which is
   > the only place its API change is justified. 668 scopes its own limitation
   > to "runtime validation of an arbitrary function", so it never claimed the
   > general case.
   >
   > Calls the compiler cannot see are a separate matter from either, and
   > belong to that epic's stage 13 rather than here.

   So what an annotation on a function *means* is settled; what is still
   missing is the schema form to write one with — and until 668's
   representation half lands, a function annotation is **unavailable, not
   merely weaker**. There is no function case in RTTI, so there is no binding a
   `/*: */` on a function could name: evaluation would either reject it as not
   a schema or accept something like `unknown`, which supplies none of the
   checking described above. So on a function declaration `@type` stays the
   only option, and `/*: */` joins it on the rest of the module.

4. **Generic schemas.** Roughly 190 `@template` uses today (re-measure rather
   than cite; the figure drifts). A generic type is naturally a
   *function from schemas to schemas* — `array` and `record` already are — so
   the value layer needs nothing new. What needs design is `Ts<>` and `.d.ts`
   emission for a parameterised alias.

5. **Nominal types.** [`fjs/types/nominal`](../../fjs/types/nominal/module.f.mjs)
   has no RTTI representation and no issue of its own. Branding is a
   compile-time-only fiction — `asNominal` is `identity` — so either RTTI gains
   a nominal wrapper carrying a brand, or nominal types stay a TypeScript-era
   construct.

## Sketch of an order, when the time comes

1. Recognize `/*: … */` in the compiler's parser and read its body as a
   **single identifier** — not as an expression handed to the expression
   parser. That is the whole point of the narrowing above: the annotation
   grammar is one name, so recognizing it needs no expression grammar inside a
   comment, and the parser gains no new syntax surface.
2. Resolve that name to a binding in scope and evaluate **the binding** at
   compile time ([`fjs/fsc/todo/047-fsc-meta-programming.md`](../../fjs/fsc/todo/047-fsc-meta-programming.md)) — ordinary
   identifier resolution, the same lookup any other reference gets. There is no
   "annotation expression" to evaluate.

   **Anchoring comes first.** Once the compiler consumes an annotation, a
   binding used *only* to name or build a schema becomes unreachable from the
   EDAG root when the reference is erased during lowering — and the module
   compiler rejects that, so the module does not compile. That is the epic's
   **stage 12**, which it requires before stage 4 for exactly this reason;
   recognizing an annotation (step 1) is unaffected. Do not start this step
   without it.

   *(An earlier draft of these two steps said to hand the body to the
   expression parser and evaluate an annotation expression. That predates the
   narrowing and would have reintroduced exactly the grammar-in-comments the
   design rejects.)*

**Everything past step 2 belongs to the epic, and this list deliberately stops
restating it.** [rtti-type-system](../../todo/rtti-type-system.md)'s Tasks
section owns declaration generation, literal checking, inference, function
schemas and their order — `.d.ts` emission, stage 5's reader, the 7a → 6 → 7b
split, and the gates between them. Read the order there.

That is a change of approach, not an omission. This list previously enumerated
those stages in its own words, and went stale **four separate times** during
review of #1719 while the epic's analysis moved underneath it: it told
implementers to hand the annotation body to the expression parser, ordered
inference before function schemas, omitted the anchoring gate, and described
`.d.ts` generation as plumbing that could land first. Each restatement was
internally coherent and quietly wrong, and a restatement cannot be kept correct
by anything short of re-reading the source it paraphrases.

Steps 1 and 2 stay because they are this document's own subject — the
annotation form and how a name resolves — rather than a paraphrase of a stage.

## Depends on

- [compile-modules-to-edag](../../fjs/djs/todo/compile-modules-to-edag.md) —
  the `,` anchoring operation for a non-resulting computation. Without it a
  module whose only use of an import is in an annotation is **rejected**, so
  this is a prerequisite of evaluating an annotation, not a later optimization.
- [`fjs/fsc/todo/047-fsc-meta-programming.md`](../../fjs/fsc/todo/047-fsc-meta-programming.md) — the compiler loading and
  running modules as meta-programming, which is what compile-time evaluation of
  an annotation's named binding requires.
- [fjs-nanvm-integration.md](../../todo/fjs-nanvm-integration.md) and
  [`fjs/fsc/README.md`](../../fjs/fsc/README.md) — the path to a compiler that
  parses authored FunctionalScript.
- [js-string-literals](./2460-js-string-literals.md) — FunctionalScript's string
  grammar is JSON's, so the repository's own single-quoted `.mjs` sources are
  not yet input the parser accepts. Normalizing them is a precondition of the
  [stage-2](../../fjs/fsc/README.md#stage-2-mark-compiler-compatible-functionalscript)
  rename, not a tokenizer defect.

## Consequences for the TypeScript-era work

- [inline-type-casts.md](../../todo/inline-type-casts.md) is **implemented** —
  its header records 273 of 357 sites removed or converted, with 84 remaining
  and a reason for each. (An earlier draft here called it unchanged and cited
  208 of 357; that predates the audit landing.) Nothing in this direction
  changes that work or is changed by it.
- [eslint.md](../../todo/eslint.md)'s three proposed custom rules — inline
  `@type` cast, unknown JSDoc tag, type-predicate placement — are
  **transitional**: worth having while JSDoc is the annotation form, but they
  must not be used to justify building a TypeScript-type grammar. All three are
  satisfiable by matching on the comment's first character plus the JS token
  stream, with no type parsing. (An earlier draft here called them
  `no-inline-type-cast` and `no-unknown-jsdoc-tag`; `eslint.md` names no rule
  ids and none exist yet, so those were never real names.)
- [tsconfig-strict-flags.md](../../todo/tsconfig-strict-flags.md) and
  [strict-static-analysis.md](../../todo/strict-static-analysis.md) are unaffected, and
  are the near-term work. `tsc` and the standard toolchain remain the
  checker until all of the above exists.

## Related

- [rtti-type-system](../../todo/rtti-type-system.md) — the epic this
  document supports: RTTI as the sole source of truth for compile-time and
  run-time verification. Stages 2–5 land here.
- [`fjs/rtti/README.md`](../../fjs/rtti/README.md) — the schema system
  this builds on.
- [`fjs/rtti/todo/668-rtti-function-types.md`](../../fjs/rtti/todo/668-rtti-function-types.md) —
  the schema-side half of open question 3.
- [type inference](./3370-type-inference.md) — the other half: annotations are
  only as useful as what can be inferred without them, and open question 2 below
  is where the two meet.
- [new-pl.md § Type System](../../todo/new-pl.md#type-system) — the same idea one
  level further out: type checking as an opt-in library rather than a language
  feature. This document is the FunctionalScript-scoped version.
- [edag-spec.md](../../todo/edag-spec.md) — already specifies the EDAG with RTTI and
  generates Rust from it; the same schemas would feed both.
- [types-for-fs.md](../../todo/types-for-fs.md) — why TypeScript's own type system is not
  the target.
- [`fjs/bnf/todo/layered-parser.md`](../../fjs/bnf/todo/layered-parser.md) — the
  transducer stack the tokenizer work belongs to.
