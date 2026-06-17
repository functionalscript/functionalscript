# 66H-declarative-tool-definitions. Refactor MCP tool definitions from imperative to declarative

**Priority:** P3
**Status:** open

## Problem

The MCP handlers implementation uses an imperative approach: `toolsList` returns a hardcoded array of tool descriptors, and `toolsCall` contains a large switch statement mapping tool names to handlers. This mismatch between the type definition (which expects `toolsList` to take `ToolsListParams`) and the implementation (which takes no parameters) suggests the design is incomplete.

Current issues:
1. The `toolsList` method signature doesn't match the `McpHandlers<O>` type (takes no params, type says `ToolsListParams`)
2. Tool definitions (`casAddTool`, `casGetTool`, `casListTool`) are separate from their handlers
3. The `toolsCall` switch statement couples tool metadata with handler logic
4. Adding a new tool requires editing the hardcoded array and extending the switch statement

## Proposal

Refactor to a declarative, data-driven approach where:
- Define an array of tool configurations, each containing:
  - Tool metadata (name, description)
  - Input schema (RTTI definition; JSON schema generated via `toJsonSchema`)
  - Output schema (RTTI definition)
  - A handler function
- Replace the switch statement with generic dispatch over this array
- Similar to how CLI dispatch works

This aligns with:
- The existing `Tool` type already separates metadata from handlers
- Other parts of the codebase that use declarative tool/command registration
- Type correctness (no signature mismatch)
- Scalability (adding tools becomes additive, not scattered edits)

## Tasks

- [ ] Define a tool registry type capturing metadata + handler + schemas
- [ ] Convert `cas_add`, `cas_get`, `cas_list` to declarative definitions
- [ ] Refactor `toolsCall` to generic dispatch over the registry
- [ ] Update `toolsList` to derive tools from the registry
- [ ] Verify type correctness with `McpHandlers<O>`
