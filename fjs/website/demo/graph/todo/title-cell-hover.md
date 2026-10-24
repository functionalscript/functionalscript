## Hover the whole title cell

**Priority:** P3
**Status:** wip

### Problem

Graph tracing activates a node title only over its text. Blank space in a
tall title cell does not highlight its incoming connections.

### Tasks

- Cover the full visible title column with a transparent hover target.
- Keep operand cells independent, and do not invent targets for empty titles.
- Preserve incoming-only tracing, focus priority, rounded highlights and layout.
- Verify RTTI and compiler EDAG graphs in both themes, including grouped titles.
