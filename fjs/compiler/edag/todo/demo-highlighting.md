## Trace expression graph connections

**Priority:** P3
**Status:** wip

### Problem

Shared expressions and recursive returns are hard to follow in the compiler
EDAG demo. The shared graph renderer already provides tracing for RTTI.

### Tasks

- Enable tracing in the EDAG demo without changing graph construction or layout.
- Follow an operand from either its name or reference cell to its target;
  trace all incoming uses when hovering an expression title.
- Preserve lazy-edge dashes during highlighting and keep inline values inactive.
- Verify recursion, sharing, focus, keyboard navigation and both themes.
