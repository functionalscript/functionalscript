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

Extract the tool registry pattern into `fs/mcp` as a reusable builder/factory:

1. **Define a generic `ToolRegistry` type** in `fs/mcp/module.f.ts`:
   ```ts
   type ToolEntry<O extends Operation> = {
       readonly name: string
       readonly description: string
       readonly inputSchema: unknown  // JSON schema
       readonly handle: (c: Context, args: unknown) => Effect<O, ToolsCallResult>
   }
   
   type ToolRegistry<C, O extends Operation> = readonly ToolEntry<O>[]
   ```

2. **Create a factory function** `fromRegistry` that takes a registry and returns `McpHandlers<O>`:
   ```ts
   export const fromRegistry = <C, O extends Operation>(
       context: C,
       registry: ToolRegistry<C, O>,
   ): McpHandlers<O> => ({
       toolsList: () => pure({ tools: registry.map(entry => ...) }),
       toolsCall: ({ name, arguments: args }) => {
           const entry = registry.find(e => e.name === name)
           // Generic dispatch
       },
   })
   ```

3. **Make this the default pattern** for MCP server creation, not an implementation detail

## Benefits

- **DRY**: No more duplicating toolsList/toolsCall boilerplate across MCP servers
- **Composability**: Multiple registries can be merged or extended
- **Consistency**: All MCP servers follow the same declarative pattern
- **Maintainability**: Core dispatch logic lives in one place, not in each server
- **Type safety**: Registry entries carry their validation and handler together

## Tasks

- [ ] Extract `ToolRegistry` and `ToolEntry` types to `fs/mcp/module.f.ts`
- [ ] Implement generic `fromRegistry` factory function
- [ ] Refactor `fs/cas/mcp/module.f.ts` to use the shared factory
- [ ] Document the pattern as the recommended way to build MCP servers
- [ ] (Optional) Consider allowing dynamic registry composition/merging
- [ ] (Optional) Add type-level validation that all registry entries are unique by name
