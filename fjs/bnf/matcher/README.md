# Matcher Core

The layer every BNF matcher backend shares: the position it matches at, the AST
it builds, and the constructors that pair them.

[`../ll1`](../ll1) and [`../descent`](../descent) are two machines over one
contract. The contract is what lives here — not the machines.

## What is shared, and what is not

`Cursor`, `Ast<L>`, `AstSequence<L>`, `AstTag`, `AstResult<L, P>`, and the
`leafAt` / `symbolAt` / `physicalIdx` / `mrSuccess` / `mrFail` functions over
them. All of it follows from
[the EOF contract](../README.md#logical-eof-in-parser-input), which every present
and future backend has to implement identically or be wrong.

The machines do **not** belong here, and one matcher covering both would be worse
than two. `../descent` backtracks: three frame kinds, a per-frame rewind to the
sequence's start, and a furthest-failure high-water mark that outlives the
rewinds. `../ll1` is predictive: sequence and repetition frames with no rewind
state, and a cursor that never moves backwards. Their public results are different types on purpose —
`{ ast, success, idx, failure? }` against `readonly [ast, success, Remainder]`.

Nor is a leaf. A backend picks `L` for what it keeps of a consumed symbol:
`../ll1` keeps the code point, `../descent` keeps it paired with metadata, which
is the whole reason that backend exists. `CodePointMeta<T>` stays in
`../descent`.

## One module rather than three

The three concepts are interdependent — `leafAt` produces AST leaves, and
`mrSuccess` builds AST nodes positioned by a cursor — so splitting them would put
one concept behind three imports.

## `symbolOf`

`symbolAt` is the only function a leaf shape is visible to, and it takes that as
a parameter rather than branching on it:

```js
const symbolOf = identity          // ../ll1: the leaf is the symbol
const symbolOf = ([symbol]) => symbol   // ../descent: the symbol is its first half
```

Each backend binds the partial application once at module scope, per
[fjs/AGENTS.md §3.3](../../AGENTS.md#place-curried-partial-applications-at-their-dependencys-scope):
the binding's scope says it depends on the leaf shape and nothing else.

## Where the cursor is documented

Three places used to describe it, and drifted apart:

- [`../README.md`](../README.md#logical-eof-in-parser-input) keeps the
  **normative** statement — what a caller supplies, what a backend synthesizes,
  what a public position means.
- `./types.ts` on `Cursor` holds the **mechanics** — why `length + 1` is a
  position, and why consuming EOF counts as progress.
- Each backend's README keeps only what is true of **it**: `../ll1` never
  rewinds; `../descent` rewinds and tracks a furthest failure.
