# MCP (Model Context Protocol) Tool Registry

This module provides type-safe builders and factories for composing MCP tool servers using a declarative registry pattern.

## Overview

The MCP protocol allows servers to expose tools that clients (like Claude) can discover and invoke. This module extracts the tool registry pattern into reusable building blocks so that:

- **Type safety is automatic**: Handler parameters are validated and properly typed via `Ts<T>` — no manual casting needed.
- **Composition is declarative**: Define tool entries with metadata and handlers; compose them into a registry.
- **Boilerplate is eliminated**: Core dispatch logic lives in `fromRegistry`, not duplicated across servers.
- **Consistency is enforced**: All MCP servers follow the same declarative pattern.

## Core Concepts

### `ToolEntry<O>`

A single declarative tool entry that combines:
- `name`: The tool identifier (used in `tools/call` requests)
- `description`: Human-readable description for `tools/list`
- `inputRtti`: Runtime type info for input validation
- `handle`: A type-safe handler receiving pre-validated arguments

```ts
type ToolEntry<O extends Operation> = {
    readonly name: string
    readonly description: string
    readonly inputRtti: Type
    readonly handle: (args: Unknown) => Effect<O, ToolsCallResult>
}
```

### `toolEntry` Builder

Creates a type-safe tool entry by binding an RTTI schema with a handler. The builder validates arguments at runtime and passes pre-validated, properly-typed arguments to the handler.

```ts
const toolEntry = <T extends Type, O extends Operation>(
    name: string,
    description: string,
    inputRtti: T,
    handle: (args: Ts<T>) => Effect<O, ToolsCallResult>
): ToolEntry<O>
```

**Benefits**:
- The handler parameter type `Ts<T>` is enforced at compile time.
- Validation happens internally — no manual `validate()` calls or type assertions in handlers.
- Error results are constructed consistently.

### `fromRegistry` Factory

Builds complete `McpHandlers<O>` from a registry of tool entries. Generates:
- `toolsList`: Converts entries into MCP `Tool` descriptors with JSON schemas
- `toolsCall`: Dispatches by tool name and delegates to the appropriate handler

```ts
export const fromRegistry = <O extends Operation>(
    registry: readonly ToolEntry<O>[],
): McpHandlers<O>
```

## Example: Building a Simple MCP Server

Define argument schemas as RTTI:

```ts
import { string, number, option } from '../../types/rtti/module.f.ts'

const addArgs = { a: number, b: number } as const
const greetArgs = { name: string, greeting: option(string) } as const
```

Create tool entries with type-safe handlers:

```ts
import { toolEntry, errorResult } from '../../mcp/module.f.ts'

const addTool = toolEntry(
    'add',
    'Add two numbers and return the result',
    addArgs,
    ({ a, b }) => pure({ content: [{ type: 'text', text: `${a + b}` }] })
)

const greetTool = toolEntry(
    'greet',
    'Greet someone by name',
    greetArgs,
    ({ name, greeting }) => {
        const msg = `${greeting || 'Hello'}, ${name}!`
        return pure({ content: [{ type: 'text', text: msg }] })
    }
)
```

Compose into a registry and build handlers:

```ts
import { fromRegistry, mcpStep, type McpHandlers } from '../../mcp/module.f.ts'

const myHandlers = fromRegistry([addTool, greetTool])

// Ready to use with mcpStep and your MCP transport
```

## Error Handling

Tool-level errors are returned in-band via `isError: true`. Use the `errorResult` helper:

```ts
import { errorResult } from '../../mcp/module.f.ts'

const safeTool = toolEntry(
    'example',
    'An example tool',
    someArgs,
    (args) => {
        if (!someValidation(args)) {
            return pure(errorResult('validation failed: ...'))
        }
        return doWork(args)
    }
)
```

## The CAS MCP Server: A Real-World Example

The content-addressable store MCP adapter (`fs/cas/mcp/module.f.ts`) demonstrates the pattern in production:

1. Define argument schemas (`casAddArgs`, `casGetArgs`, `casListArgs`)
2. Build a registry with `toolEntry` and type-safe handlers
3. Pass the registry to `fromRegistry` to get complete handlers
4. Compose with `mcpStep` and `stdioTransport` to run the server

This replaces ~100 lines of manual `toolsList`/`toolsCall` boilerplate with a single declarative registry.

## Migration Guide: Adding a New MCP Server

Instead of manually implementing `McpHandlers<O>`:

```ts
// ❌ Old pattern (don't do this)
export const myHandlers: McpHandlers<O> = {
    toolsList: () => pure({ tools: [...] }),
    toolsCall: ({ name, arguments: args }) => {
        switch (name) {
            case 'tool1':
                const [t, validated] = validate(tool1Args)(args)
                if (t === 'error') return pure(errorResult(...))
                return handle1(validated)
            // ... repeated for every tool
        }
    }
}
```

Use the declarative pattern:

```ts
// ✅ New pattern (use this)
const registry: readonly ToolEntry<O>[] = [
    toolEntry('tool1', 'description', tool1Args, handle1),
    toolEntry('tool2', 'description', tool2Args, handle2),
    // ...
]

export const myHandlers = fromRegistry(registry)
```

The factory handles validation, dispatch, and error wrapping transparently.

## Type Safety Model

### The Type Guarantee

When you write:

```ts
const myTool = toolEntry(
    'add',
    'Add numbers',
    { x: number, y: number } as const,
    ({ x, y }) => {
        // x and y are inferred as `number` — no casting needed
        return pure({ content: [{ type: 'text', text: `${x + y}` }] })
    }
)
```

TypeScript ensures that:
- The handler parameter type is `{ x: number, y: number }`, not `Unknown`
- Any attempt to access undefined fields or use wrong types is caught at compile time
- The RTTI schema and handler type are kept in sync by construction

### How It Works

The `toolEntry` builder:
1. Takes the RTTI schema `T` and a handler expecting `Ts<T>` (the TypeScript type)
2. Returns a `ToolEntry<O>` with a wrapper that validates at runtime
3. The wrapper calls `validate(inputRtti)` and casts the result as `Ts<T>`

This pattern is safe because:
- Validation is proven to produce `Ts<T>` (by construction of the RTTI schemas)
- TypeScript enforces the contract at the callsite
- The type system doesn't see the internal `as Ts<T>` cast — it's encapsulated

## Extensibility

The registry pattern composes naturally:

```ts
// Merge registries from multiple modules
const combinedRegistry = [
    ...coreTools,
    ...extendedTools,
] as const

export const handlers = fromRegistry(combinedRegistry)
```

Future enhancements could include:
- Runtime validation that registry entries are unique by name
- Middleware/interceptors for logging, caching, or auth
- Dynamic registry merging or hot-reloading
- Pagination support for large registries
