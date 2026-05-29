# 146. RTTI: TypeScript Inference Depth

**Priority:** P3
**Status:** open

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

## Recommendation

Start with option 1 (constrain `Ts<T>` to short-circuit on `any`) — cheapest and fixes the largest class of accidental overflow. Then consider option 3 (phantom output on thunks) if internal inference quality matters for follow-on work like [i143](./143-rtti-data.md) or a future data-driven parser. Option 4 is the honest fallback if the cost-benefit doesn't justify the work.

## Related

- [i133](./README.md) — the shared kernel refactor that triggered this analysis. The visitor is assembled with an opaque return type and a top-level cast specifically because generic per-variant helpers would otherwise force TS to evaluate `Ts<any>`.
- [i143](./143-rtti-data.md) — the serializable data form. Whatever inference strategy is adopted here must extend to the data form, since both forms describe the same set of TS types.
- [i141](./README.md) — universal extensible type system based on custom RTTI. Inference quality is one of the things a generic `TypeSystem<T>` interface needs to consider.
