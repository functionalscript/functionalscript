# EDAG — the FunctionalScript expression DAG

An **EDAG** is a compiled computation written down as an ordinary
FunctionalScript value. It is what a function *is*: the input the `Function`
constructor accepts, what `toString(f)` prints back as source, and what the
content hash addresses.

Both halves of the name are load-bearing.

- **Expression** — there are no statement nodes. `const` is sharing, `return`
  is the root node, and every node is an expression.
- **DAG** — an operand position holds a real reference to a node, so
  referencing one node from two positions means *one value used twice*.
  Sharing is semantic, not an optimization: `['[]', x, x]` builds an array
  whose two elements are the same object, while `['[]', ['{}'], ['{}']]`
  builds two distinct ones. No tree denotes what an EDAG denotes.

The semantics are developed in
[`todo/edag-stage1-discussion.md`](../../todo/edag-stage1-discussion.md) and
will be distilled into [`todo/edag-spec.md`](../../todo/edag-spec.md). This
module is the implementation of what those documents decide.

## What is here, and what is deliberately not

This directory owns the **EDAG data model itself**: the node types, the
canonical operation tags and their operand shapes, the structural entry forms,
and the validation rules that depend only on an EDAG value.

Everything about getting *to* an EDAG belongs to its consumers. The dependency
is one-way —

```text
fjs/edag/
    ↑
fjs/djs/
```

— so DJS parsing, module loading, the temporary `Unresolved { imports, edag }`
wrapper, recursive import resolution, and `.f.js` serialization all stay in
[`fjs/djs`](../djs/README.md). Import paths are not part of an EDAG, and
nothing here may reach back for them.

## Stage 1 vocabulary

The rollout is staged by
[`fjs/djs/todo/compile-modules-to-edag.md`](../djs/todo/compile-modules-to-edag.md).
Stage 1 is what an unresolved module needs, and no more:

| Form | JavaScript | Notes |
|------|------------|-------|
| `2.5`, `'a'`, `true`, `null`, `undefined`, `34n` | itself | a constant — any non-object, non-array value |
| `['[]', ...node]` | `[…]` | array constructor |
| `['{}', ...entry]` | `{ … }` | ordered object constructor; the one entry form is `[':', key, value]` |
| `['args']` | — | the arguments array |
| `['.', object, property]` | `o.p`, `o[p]` | property access; `property` is restricted |

`['args']` is what makes stage 1 the stage that unresolved modules need: at
module scope it is the array of imported module values, so import *i* is
`['.', ['args'], i]` and a module compiles before any of its imports are read.

Stage 2 adds `['=>', frame, body]`, `['()', object, args]`, and
`['.()', object, property, args]`; operators, `[',', …]`, `['throw', …]`,
`['own', …]`, `['self']`, and `['frame']` are later still. Each is an
*addition* — operand shapes are specified per tag rather than by a global "an
array in operand position is a tagged operation" rule, so a later operation
with a differently shaped operand never changes an existing form.

Plain objects are **reserved** and have no EDAG meaning: an object value is
built by `['{}', …]`, so the two never compete for one spelling.

## Validation is a total gate

`validate` is not a sanity check on compiler output. The EDAG is a *public*
input, so it will see graphs no FunctionalScript compiler would emit, and "our
compiler would never produce that" is never an argument for admitting one.
Every rule the types cannot state is enforced here — see the module JSDoc in
[`module.f.mjs`](./module.f.mjs) for the list.

Two of them deserve their reasoning here rather than at the code.

### The property operand: unrepresentable, not guarded

`['.', object, property]` takes a **constant** string or number. There is no
spelling for `o[name]` with a computed `name`, so the abuse
[2330](../../spec/todo/2330-property-accessor.md) documents —
`f.constructor('…')`, `__proto__` — cannot be written down at all, rather than
being written down and then checked at run time. That is a stronger property
than a guard: nothing downstream has to remember to apply it.

The permitted string constants are those not on 2330's prohibited list, which
this module reproduces as five arrays named after the tables they come from.
It covers the two prototype-chain names and every instance-method name 2330
tabulates. Method names are prohibited *in a property position* whether or not
the method has a side effect, because `a.indexOf` detached from `a` is a
different value from the method call `a.indexOf(x)` — which is exactly why
stage 2 introduces a separate `'.()'` operation instead of composing `'.'` with
`'()'`.

Two consequences worth stating plainly:

- **Stage 1 rejects more than it eventually will.** A data property that
  happens to be named `map` or `get` has no stage 1 spelling. The later
  `['own', object, key]` — own properties only, no prototype chain, so a
  computed name is harmless — is where such an access belongs. Rejecting is
  recoverable; admitting something unsafe is not.
- **`'.()'` will need a different, smaller list.** A method call whose whole
  purpose is calling a method cannot inherit "no method names". Which names a
  call position prohibits (the mutating and iterator-returning ones, by 2330's
  side-effect columns) is settled with `'.()'` in stage 2, not assumed here.

The `Function` instance properties 2330 tabulates — `name`, `prototype`,
`caller`, `arguments`, `displayName` — are **not** on this list. Prohibiting
`name` would reject `{ name: 'x' }.name`, an ordinary data access, and the
escape it might otherwise open is already closed: reaching `Object` from
`f.prototype` needs `constructor`, which is prohibited.

### Entry descriptors are structural, not nodes

`[':', key, value]` is an operand *of* `['{}', …]`, never evaluated on its own.
Its container identity therefore means nothing, so validation rejects the same
entry array appearing in two entry positions — otherwise DJS would faithfully
preserve a distinction with no semantics, and two equivalent objects would hash
differently. The `key` and `value` inside are ordinary nodes whose identities
are shared as usual.

Entry order is likewise semantic and never sorted: JavaScript applies
object-literal definitions in source order, a duplicate key lets a later entry
overwrite an earlier one, and insertion order of non-index keys is observable.
The canonical sorting `fjs compile` applies to data output must not reach an
object constructor's entries.

## Why a hand-written validator rather than an RTTI schema

[`todo/edag-spec.md`](../../todo/edag-spec.md) plans for the EDAG schema to be
an [RTTI](../types/rtti/README.md) schema, with the Rust types and the
`Function` constructor's validation generated from it. That is still the
target, and it is not what stage 1 can be.

RTTI describes tuples of fixed length; `['[]', ...node]` and `['{}', ...entry]`
are variadic tuples with a tag in the head, which RTTI has no form for. More
fundamentally, the rules that matter most here are not shape rules at all:
acyclicity, node-identity sharing, and entry-descriptor aliasing are properties
of the *graph*, invisible to any schema that walks a value structurally. A
schema will eventually carry the shape half and generate the Rust half; the
graph half stays hand-written either way.

The error shape is shared rather than invented: `validate` reports RTTI's
`{ path, message }` (`../types/rtti/common/types.ts`), with the path built from
operand indices, so a consumer reporting an EDAG failure and one reporting a
schema failure format the same value.

`validate` also follows RTTI's `validate`, not its `parse`, in returning **the
value it was given**. Reconstruction is not available to an EDAG reader at all:
node identity is semantic, so a rebuilt graph is a different computation.
