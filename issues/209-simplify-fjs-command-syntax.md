# 209. Simplify fjs command line syntax: change from `fjs cas mcp` to `fjs mcp`.

**Priority:** P2
**Status:** open

## Description

Currently, the fjs CLI requires calling `fjs cas mcp` to invoke the MCP server via the CAS (content-addressable storage) layer. This proposal is to simplify the command syntax to `fjs mcp` by removing the intermediate `cas` command.

## Rationale

The MCP server will have more functionality than CAS in the future, and the CAS layer will become an internal implementation detail rather than a primary user-facing interface. Removing the `cas` command level will:

1. Simplify the user-facing API
2. Allow direct access to MCP functionality
3. Prepare for expanded MCP capabilities beyond CAS

## Changes Required

- Update CLI argument parsing to accept `fjs mcp` directly
- Maintain backwards compatibility during transition if needed
- Update documentation and examples
- Update test cases to use new syntax

## Related Issues

None
