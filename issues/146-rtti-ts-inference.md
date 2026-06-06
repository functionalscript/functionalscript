# 146. RTTI: TypeScript Inference Depth

**Priority:** P3
**Status:** closed

**Why it's closed:** Options 1 and 3 implemented; remaining validate/parse casts documented in `fs/types/rtti/ts/README.md` as open problems requiring TypeScript rank-2 or dependent types.

`Ts<T>` (in [`fs/types/rtti/ts/module.f.ts`](../fs/types/rtti/ts/module.f.ts)) maps a schema `Type` to its TypeScript type by walking the schema's structural shape with conditional types and `infer`. It works for direct uses (`Ts<typeof someSchema>`), but it is fragile: any internal generic that resolves to `Ts<any>`, `Ts<Type>`, or a deeply nested combination distributes across every branch of the conditional and trips TS's depth/cycle limit (`error TS2589: Type instantiation is excessively deep and possibly infinite`).

The current `validate` and `parse` modules work around this with liberal `as any` casts: the public boundary is typed correctly via `Ts<T>`, but the internals deliberately bypass the checker because the structural walk cannot be made non-overflowing while preserving the rest of the design. The shared kernel from [i133](./README.md) takes the same workaround: the `Visitor<R>` is assembled with an `as unknown as Visitor<(v: Unknown) => unknown>` cast so the generic per-variant helpers don't force TS to evaluate `Ts<any>`.

This issue tracks the inference problem and the design space around fixing it.

## What other frameworks do

The standard trick is **compute the TS type once at schema construction time, attach it as a phantom field, look it up later**. Inference becomes one indexed access instead of a recursive walk.

### Zod

- Every schema is a class instance: `z.ZodObject<{ a: z.ZodNumber }>`.
- The generic parameter carries `_output` (and `_input`) as phantom fields.
- `z.infer<typeof s>` is essentially `s['_output']` — a single indexed-access type, no recursion.
- The compiler does the structural walk *once*, when the builder method is called, and caches the result in the schema's type. Subsequent inferences are cheap.
- Cost: wrapper classes, large generic noise in type errors, allocation on every builder call.

### Valibot

- Plain objects instead of classes, same trick: each schema has a phantom `'~types'` field with `{ input; output }` on it.
- `Output<typeof s>` plucks the field.
- Builders precompute the field's type from their arguments and bake it in.
- Lighter than Zod (no class hierarchy) but the inference strategy is identical.

### ArkType

- Schemas are *strings* parsed by a parser written in the TypeScript type system using template literal types.
- To keep TS performant, they:
  - Split the parser into many tiny named alias types — each named alias acts as a memoization point for the compiler.
  - Use `extends` constraints to cut off `any`/`unknown` paths early before they distribute.
  - Avoid known exponential patterns (deep `extends` chains, unnecessary distributive conditionals).
  - Maintain a dedicated `@ark/util` of compiler-friendly type combinators.
- Inference is still expensive but bounded. They spend significant engineering specifically on keeping TS performance acceptable.

### Common pattern

All three precompute. None of them re-derives the TS type by walking the schema's structural shape every time it is queried — that is what we do, and it is what causes our overflow cases.

## Why our design is incompatible with the standard trick

Schemas are raw values in our design: `{ a: 42 }` *is* a schema, and `42` *is* a schema. Attaching a phantom output field would force schemas to be wrapper objects rather than plain data, which:

- Conflicts with the const-literal ergonomics (`validate({ a: 42 } as const)` would need re-wrapping).
- Breaks the data-first principle behind [i143](./143-rtti-data.md) (the serializable data form has nothing to attach a phantom *runtime* field to, and the type-level phantom would be lost across serialization).
- Mismatches the FunctionalScript principle of schemas being plain JSON-shaped values.

So adopting Zod/Valibot's approach wholesale would compromise the rest of the architecture.

## Design space

Options that keep schemas as data, ordered by invasiveness.

### 1. Constrain `Ts<T>` to never see `any`/`unknown`

The overflow cases are all places where an internal generic widens to `Ts<any>` or `Ts<Type>` and then distributes across every branch of the conditional. Adding an explicit narrowing — e.g. an upper bound, or a fast-path `T extends any ? unknown : ...` — short-circuits the distribution.

- Cheap, local change to `Ts<T>`.
- Removes the largest single class of overflows.
- Does nothing for genuinely deep user schemas.

### 2. Split `Ts<T>` into more memoized named aliases

ArkType's main trick. Each named type alias is a memoization point for the compiler; splitting one large conditional into several smaller ones with explicit aliases reduces re-evaluation.

- `ConstTs`, `Info1Ts`, etc. are already split. Push further: cache `Ts<readonly ...>`, `Ts<{ [k: string]: ... }>`, and the `or` variant union as their own aliases.
- No design impact, just type-level refactoring.
- Modest improvement; not a complete fix.

**Attempted and reverted.** Extracted `InfoTs<I>` (the thunk-body dispatch) and `OrTs<A>` (the union case) as named aliases and wired `Ts<T>` to delegate to them. `npx tsc` reported new TS2589 errors in `fs/json/module.f.ts` and the validate/parse proofs. The extra indirection (`Ts` → `InfoTs` → `Info1Ts` → `ArrayTs` → `Ts`) adds levels to the recursive chain and makes TypeScript hit its depth limit sooner. The inline form stays flatter and the compiler can short-circuit earlier. Option 2 does not apply to our recursive schema design.

### 3. Phantom output on thunks only

Schemas-as-data still works for `Const` schemas — those are already concrete TS values and their TS type is their own type. The overflow happens almost entirely in the *thunk* branch, where `Ts<T>` has to `infer` through `() => readonly['array', T]` and recurse.

```ts
type Thunk<T> = (() => Info) & { readonly $out?: T }
type Ts<S> =
    S extends { readonly $out?: infer T } ? T :
    ConstTs<S>
```

- Builders like `array(t)` set `$out` to the precomputed output type.
- Recursive thunks self-reference through `$out` — one indexed access, no recursion through the schema body.
- `Ts<Const>` remains structural, which is fine because const values already *are* their own TS type at literal precision.
- Cost: thunks are no longer plain `() => ...` functions at the type level; they carry a phantom field. The runtime is unaffected.
- This is the most promising option: it adopts the Zod/Valibot trick exactly where we need it (recursive thunks) without compromising the const-as-schema ergonomics or the data form in [i143](./143-rtti-data.md).

### 4. Accept the status quo as a design feature

The internals of `validate` and `parse` use `as any` and the public boundary carries the type guarantee. This is defensible:

- `Ts<T>` is correct by construction for the schemas users actually write.
- `as any` at the boundary between dispatch and per-variant handlers is a localized escape hatch, not a pervasive disabling of type checking.
- The cost of fixing the inference is significant; the benefit is only internal cleanliness.

Document this choice and move on.

## Progress

### Option 1 — done

Added `unknown extends T ? Unknown :` as the first branch of `Ts<T>` in
`fs/types/rtti/ts/module.f.ts`. When `T` is `any`, `unknown extends any` is
`true`, so the conditional short-circuits to `Unknown` without distributing across
all branches. A type-level assert confirms: `type _any = Assert<Equal<Ts<any>, Unknown>>`.

### Option 3 — done

Implemented `WithOut<S, Out>` in `fs/types/rtti/ts/module.f.ts` and the `$out` branch in `Ts<T>`.
First use: `fs/json/schema/module.f.ts` annotates its recursive `unknown` schema with `WithOut<typeof unknownThunk, UnknownConst>`, so `Ts<typeof unknown>` short-circuits to `UnknownConst` without walking the struct body.

The phantom approach: attach a `$out?: Out` field to thunks and check it first in `Ts<T>`:

```ts
export type WithOut<S, Out> = S & { readonly $out?: Out }

export type Ts<T extends Type> =
    unknown extends T ? Unknown :               // option 1
    T extends { readonly $out?: infer O } ? Exclude<O, undefined> :  // option 3
    T extends () => infer I ? (...) :
    ConstTs<T>
```

Builders (or their return values) carry the precomputed output type at construction time.
For example `fs/json/rtti/module.f.ts` would annotate its recursive schemas:

```ts
export const unknown: WithOut<typeof _unknown, json.Unknown> = _unknown as any
export const object: WithOut<Type1<'record', typeof unknown>, { readonly [k: string]: json.Unknown }> = record(unknown) as any
export const array: WithOut<Type1<'array', typeof unknown>, readonly json.Unknown[]> = rttiArray(unknown) as any
```

Then `Ts<typeof json.unknown>` → reads `$out` → returns `json.Unknown` directly
(one indexed-access, no structural walk).

**Constraint:** `rtti/module.f.ts` cannot import `Ts<>` (circular with `ts/module.f.ts`),
so `WithOut` lives in `ts/module.f.ts` and is used at call-site via explicit type annotations.

### Remaining casts in validate/parse

After options 1 and 3, many `as any` casts were eliminated (all `verror`/`prependPath`
returns no longer need them — `Error<ValidationError>` is directly in the `Result<T>`
union). The remaining casts fall into two distinct problems:

**Problem A — visitor rank-2 erasure** (`as unknown as Visitor<...>` and the top-level
`visit(...) as any`). `Visitor<R>` requires a uniform `R` across all handlers, but each
handler has a precise generic type (e.g. `<I extends Type>(item: I): Validate<Info1<K,I>>`).
TypeScript has no rank-2 polymorphism, so the visitor record must be assembled with
type-erasure. Could be fixed by inlining the dispatch (replacing `visit` with a direct
`switch` inside `validate`/`parse`, as `toJsonSchema` does) — but this removes the
shared kernel benefit.

**Problem B — container validation** (`ok(value) as any` after a loop).
After verifying every element of a container, we return `ok(value)` where `value` is
still typed as `Container<K>` or `C extends Unknown`. TypeScript cannot narrow the
container's element types through a validation loop; it has no dependent types or
type-refinement for mutable iteration. Likely unfixable without `as any` unless we
construct a fresh typed copy (at the cost of an extra allocation in `validate`, which
is supposed to return the original value unchanged).

**Problem C — `Ts<Type>` in or/record dispatch** (`(i as any)(value)` in `orValidate`,
`(parse(t) as any)` in `constContainerParse`). When a call to `validate(r)` or `parse(t)`
is made with `r`/`t` widened to `Type`, TypeScript instantiates `Validate<Type>` and
tries to evaluate `Ts<Type>`, which distributes across all branches and triggers TS2589.
Could be fixed if the `or` and `record` paths kept the element type as a concrete generic
parameter rather than widening to `Type` — the visitor architecture currently prevents this.

## Recommendation

Start with option 1 (constrain `Ts<T>` to short-circuit on `any`) — cheapest and fixes the largest class of accidental overflow. Then consider option 3 (phantom output on thunks) if internal inference quality matters for follow-on work like [i143](./143-rtti-data.md) or a future data-driven parser. Option 4 is the honest fallback if the cost-benefit doesn't justify the work.

## Related

- [i133](./README.md) — the shared kernel refactor that triggered this analysis. The visitor is assembled with an opaque return type and a top-level cast specifically because generic per-variant helpers would otherwise force TS to evaluate `Ts<any>`.
- [i143](./143-rtti-data.md) — the serializable data form. Whatever inference strategy is adopted here must extend to the data form, since both forms describe the same set of TS types.
- [i141](./README.md) — universal extensible type system based on custom RTTI. Inference quality is one of the things a generic `TypeSystem<T>` interface needs to consider.
