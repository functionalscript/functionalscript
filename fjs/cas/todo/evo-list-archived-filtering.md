# Update `evo_list` archived filtering

Add an optional `archived?: true` parameter to the MCP server's `evo_list` command.

## Requirements

- Leave `archived` undefined by default.
- By default, return only active (non-archived) subjects.
- When `archived: true` is provided, include archived subjects.
- Document this as a breaking change because the default result set changes.
