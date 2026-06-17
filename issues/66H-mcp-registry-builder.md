# 66H-mcp-registry-builder. Extract and generalize MCP tool registry pattern

**Priority:** P2
**Status:** open
**Related:** 66H-declarative-tool-definitions (just implemented in CAS MCP)

## Problem

The declarative tool registry pattern introduced in `fs/cas/mcp` is powerful and should be the standard way to build MCP servers, but it's currently:

1. Only available inside the CAS MCP module as a local implementation
2. Requires each server to manually implement `McpHandlers<O>` with `toolsList` and `toolsCall` boilerplate
3. Not easily reusable or composable across different MCP servers

Currently, to add a new MCP server, developers must:
```ts
export type McpHandlers<O extends Operation> = {
    readonly toolsList: (params: ToolsListParams) => Effect<O, ToolsListResult>
    readonly toolsCall: (params: ToolsCallParams) => Effect<O, ToolsCallResult>
}
```

Then manually implement both methods with validation/dispatch logic.

## Proposal

Extract the tool registry pattern into `fs/mcp` as a reusable builder/factory with **type-safe handlers**:

1. **Define a generic `ToolRegistry` type** in `fs/mcp/module.f.ts`:
   ```ts
   type ToolEntry<O extends Operation> = {
       readonly name: string
       readonly description: string
       readonly inputRtti: Type
       readonly handle: (args: Unknown) => Effect<O, ToolsCallResult>
   }
   
   // Type-safe handler definition — arguments are pre-validated as Ts<T>
   type ValidToolEntry<T extends Type, O extends Operation> = {
       readonly name: string
       readonly description: string
       readonly handle: (args: Ts<T>) => Effect<O, ToolsCallResult>
   }
   ```

2. **Create a type-safe validator wrapper** `check` that binds an RTTI with a handler:
   ```ts
   const check = <T extends Type, O extends Operation>(
       inputRtti: T,
       entry: ValidToolEntry<T, O>,
   ): ToolEntry<O> => ({
       name: entry.name,
       description: entry.description,
       inputRtti,
       handle: (args: Unknown) => {
           const [t, r] = validate(inputRtti)(args)
           return t === 'error'
               ? pure(errorResult(`invalid arguments: ${r.message}`))
               : entry.handle(r as Ts<T>)
       }
   })
   ```

3. **Create a factory function** `fromRegistry` that takes a registry and returns `McpHandlers<O>`:
   ```ts
   export const fromRegistry = <O extends Operation>(
       registry: readonly ToolEntry<O>[],
   ): McpHandlers<O> => ({
       toolsList: () => pure({ 
           tools: registry.map(entry => ({
               name: entry.name,
               description: entry.description,
               inputSchema: toJsonSchema(entry.inputRtti),  // Derive JSON schema from RTTI
           }))
       }),
       toolsCall: ({ name, arguments: args }) => {
           const entry = registry.find(e => e.name === name)
           return entry === undefined
               ? pure(errorResult(`unknown tool: ${name}`))
               : entry.handle(args === undefined ? {} : args)
       },
   })
   ```

4. **Make this the default pattern** for MCP server creation, not an implementation detail

## Benefits

- **Type-safe handlers**: The `check` wrapper ensures handler parameters are pre-validated and properly typed via `Ts<T>` — no manual type assertions needed
- **DRY**: No more duplicating toolsList/toolsCall boilerplate across MCP servers
- **Composability**: Multiple registries can be merged or extended
- **Consistency**: All MCP servers follow the same declarative pattern
- **Maintainability**: Core dispatch logic lives in one place, not in each server
- **Separation of concerns**: Validation is wired separately from handler logic, reducing cognitive load

## Tasks

- [ ] Extract `ToolEntry`, `ValidToolEntry`, and `check` to `fs/mcp/module.f.ts`
- [ ] Implement generic `fromRegistry` factory function in `fs/mcp/module.f.ts`
- [ ] Refactor `fs/cas/mcp/module.f.ts` to use the shared factory (already implemented locally)
- [ ] Document the pattern as the recommended way to build MCP servers
- [ ] Add JSDoc to `check`, `fromRegistry`, and the types explaining the type-safety model
- [ ] (Optional) Consider allowing dynamic registry composition/merging (e.g., `mergeRegistries`)
- [ ] (Optional) Add compile-time validation that all registry entries are unique by name
