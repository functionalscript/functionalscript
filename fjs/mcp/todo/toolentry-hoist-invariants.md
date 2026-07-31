## toolentry-hoist-invariants. Hoist call-invariant work out of `toolEntry` and `fromRegistry`

**Priority:** P3
**Status:** open

### Problem

Two factories in `fjs/mcp/module.f.ts` re-derive call-invariant values inside
per-call closures, against the AGENTS.md rule *"Hoist call-invariant
computations out of function bodies"*:

1. `toolEntry` (`fjs/mcp/module.f.ts:179-194`) rebuilds the validator on
   **every tool invocation** — `validate(inputRtti as any)` depends only on
   `inputRtti`, which is fixed when the entry is constructed, yet it runs
   inside `handle`:

   ```ts
   handle: (a: Unknown) => {
       const [t, r] = validate(inputRtti as any)(a)
       ...
   ```

   `validate` walks the rtti schema through the visitor to *compose* the
   validator function; doing that per `tools/call` repeats structural work
   whose result never changes.

2. `fromRegistry` (`fjs/mcp/module.f.ts:216-233`) rebuilds the full `tools`
   descriptor array — including a `toJsonSchema(entry.inputRtti)` conversion
   per entry — on **every `tools/list` request**:

   ```ts
   toolsList: () => {
       const tools: Tool[] = registry.map(entry => ({ ..., inputSchema: toJsonSchema(entry.inputRtti) }))
       return pure({ tools })
   },
   ```

   `registry` is fixed when `fromRegistry` is applied; the descriptor array
   is a pure function of it and can be built once.

Beyond the wasted work, the current shape misstates the dependency structure
(see the AGENTS.md bullet on placing each partial application at the scope
matching what it depends on): the validator and the descriptor list depend on
the *entry/registry*, not on the *request*, and the code should say so.

### Proposal

Bind both values at construction scope. Verified to typecheck cleanly with
`npx tsc`:

```ts
export const toolEntry = <T extends Type, O extends Operation>(
    name: string,
    description: string,
    inputRtti: T,
    handle: (args: Ts<T>) => Effect<O, ToolsCallResult>
): ToolEntry<O> => {
    const validateArgs = validate(inputRtti as any)
    return {
        name,
        description,
        inputRtti,
        handle: (a: Unknown) => {
            const [t, r] = validateArgs(a)
            return t === 'error'
                ? pure(errorResult(`invalid arguments: ${r.message}`))
                : handle(r as Ts<T>)
        }
    }
}

export const fromRegistry = <O extends Operation>(
    registry: readonly ToolEntry<O>[],
): McpHandlers<O> => {
    const tools: Tool[] = registry.map(({ name, description, inputRtti }) => ({
        name,
        description,
        inputSchema: toJsonSchema(inputRtti),
    }))
    return {
        toolsList: () => pure({ tools }),
        toolsCall: ...  // unchanged
    }
}
```

Note on the casts: removing `as any` / `as Ts<T>` was tried and hits
`TS2589: Type instantiation is excessively deep` at the `handle(r)` call —
`Ts<T>` for an unbound `T extends Type` exceeds the compiler's recursion
limit, the same limitation already documented at
`fjs/types/rtti/parse/module.f.ts:164`. The casts stay (with a comment citing
TS2589), but they move to construction scope where they run once.

### Tasks

- [ ] Hoist `validate(inputRtti as any)` to `toolEntry`'s construction scope.
- [ ] Hoist the `tools` descriptor array (and its `toJsonSchema` calls) to
      `fromRegistry`'s construction scope.
- [ ] Add a comment on the remaining casts citing TS2589, mirroring
      `fjs/types/rtti/parse/module.f.ts:164`.
- [ ] `npx tsc` clean; `fjs t` passes (`fjs/mcp/proof.f.ts`, `fjs/cas/mcp/proof.f.ts`).

### Related

- `fjs/mcp/module.f.ts:179-194`, `:216-233` — the two factories.
- AGENTS.md — "Hoist call-invariant computations out of function bodies";
  curried-application placement rule.
- `fjs/types/rtti/parse/module.f.ts:164` — precedent for the TS2589 cast
  comment.
