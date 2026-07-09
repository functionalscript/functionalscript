# `rtti/ts` — TypeScript type inference for RTTI schemas

`Ts<T>` (`module.f.ts`) maps an RTTI schema `Type` to its TypeScript type at
compile time. It works by walking the schema's structural shape with a chain of
conditional types and `infer`.

## The problem: TS2589

TypeScript imposes a hard recursion depth on conditional-type evaluation.
`Ts<T>` is inherently recursive — `Ts<array(T)>` expands to `readonly Ts<T>[]`,
which recurses into `T`. For acyclic schemas this terminates. Two cases make it
overflow:

1. **`Ts<any>` distribution.** When an internal generic widens to `any` (common
   at module boundaries and in visitor dispatch), TypeScript distributes the
   conditional over every branch simultaneously, exhausting the limit immediately.

2. **`Ts<Type>` dispatch.** Calling `validate(r)` or `parse(t)` with `r`/`t`
   typed as `Type` forces TypeScript to evaluate `Ts<Type>`, which distributes
   across all branches and triggers TS2589 the same way.

Both cases produce `error TS2589: Type instantiation is excessively deep and
possibly infinite`.

## Solution 1 — fast-path for `any`

```ts
export type Ts<T extends Type> =
    unknown extends T ? Unknown :   // ← option 1
    ...
```

`unknown extends any` is `true`, so when `T` is `any` the conditional
short-circuits to `Unknown` before distribution begins. This prevents the largest
class of accidental overflows without touching the rest of `Ts<T>`.

## Solution 3 — `WithOut` phantom output type

For recursive schemas (e.g. the JSON Schema `unknown` type in
`fs/media/json/schema/module.f.ts`) even the non-`any` walk overflows because the
schema references itself. The fix is to annotate the schema with its output type
once, at construction time, and have `Ts<T>` read that annotation directly —
one indexed-access, no structural walk.

```ts
declare const withOutKey: unique symbol

export type WithOut<S, Out> = S & { readonly [withOutKey]?: Out }

export type Ts<T extends Type> =
    unknown extends T ? Unknown :
    T extends { readonly [withOutKey]?: infer O } ? Exclude<O, undefined> :  // ← option 3
    ...
```

`withOutKey` is a `unique symbol`, not a string. This is intentional: struct
schemas have a string index signature (`{ readonly [K in string]: Type }`), and
a string key `$out` would have to extend `Type`. A symbol key is excluded from
string index signatures, so `WithOut<S, Out>` is valid for any `Out` regardless
of whether `Out` extends `Type`.

Usage (abbreviated from `fs/media/json/schema/module.f.ts`):

```ts
const unknownThunk = () => ['const', unknownConst] as const
export const unknown: WithOut<typeof unknownThunk, UnknownConst> = unknownThunk

// unknownConst is defined after `unknown` so it can reference `unknown` recursively.
// The thunk defers evaluation, breaking the circular reference at runtime.
const unknownConst = {
    not: option(unknown),
    anyOf: option(array(unknown)),
    // ...
} as const

// UnknownConst derives each field type from the schema — no hand-written duplicates.
// The `?` markers are required: TypeScript distinguishes "field absent" from
// "field present but undefined", and JSON Schema objects only include the fields
// they need.
type UnknownConst = {
    readonly not?: Ts<typeof unknownConst.not>
    readonly anyOf?: Ts<typeof unknownConst.anyOf>
    // ...
}
```

`Ts<typeof unknown>` reads `withOutKey`, returns `UnknownConst`, never recurses
into `unknownConst`'s body.

## Why Option 2 failed

Splitting `Ts<T>` into named aliases (`InfoTs<I>`, `OrTs<A>`, …) was attempted
on the theory that each alias acts as a memoization point for the compiler
(the ArkType approach). It made things worse. The extra indirection
(`Ts` → `InfoTs` → `Info1Ts` → `ArrayTs` → `Ts`) adds levels to the recursive
chain, so TypeScript hits its depth limit sooner. The inline form is flatter and
lets the compiler short-circuit earlier. Named-alias memoization only helps for
acyclic type graphs; it does not help when the recursion is inherent in the
schema structure. Option 2 was reverted.

## Remaining open problems

Three `as any` casts in `validate/module.f.ts` and `parse/module.f.ts` cannot
be removed without language features TypeScript does not yet have:

**Problem A — visitor rank-2 erasure.** `Visitor<R>` requires a uniform `R`
across all handlers, but each handler has a precise generic type (e.g.
`<I extends Type>(item: I): Validate<Info1<K,I>>`). TypeScript has no rank-2
polymorphism, so the visitor record must be assembled with
`as unknown as Visitor<...>` and the top-level `validate`/`parse` return cast
`as any`. Would require inlining dispatch (like `toJsonSchema` does) to eliminate.

**Problem B — container validation narrowing.** After verifying every element of
a container, `ok(value)` is returned where `value: Container<K>`. TypeScript
cannot narrow the container's element types through a validation loop; it lacks
dependent types or refinement for mutable iteration. Removing the `ok(value) as any`
cast would require constructing a fresh typed copy (extra allocation, contradicts
`validate`'s return-original-value contract).

**Problem C — `Ts<Type>` in or/record dispatch.** Calling `validate(r)` or
`parse(t)` with `r`/`t` typed as `Type` forces TypeScript to instantiate
`Ts<Type>` and trigger TS2589. The visitor architecture currently widens the
element type to `Type`; keeping it as a concrete generic would require a
fundamentally different dispatch strategy. Cast is `(i as any)(value)` /
`(parse as any)(t)`.

One day, TypeScript may have more powerful type system features (rank-2
polymorphism, dependent types, or deeper memoization) that would make these
casts unnecessary.
