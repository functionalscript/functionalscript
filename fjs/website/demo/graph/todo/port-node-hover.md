# Trace connections from ports and node names

**Priority:** P3
**Status:** wip

## Problem

RTTI connections highlight from their lines, but the corresponding source
ports and node names do not provide the same way to explore the graph.

## Proposal

Hovering an output port highlights its complete connection, the source port,
and its destination node. Hovering a node name highlights every incoming and
outgoing connection. Scope the relationships to each SVG, preserve keyboard
and click focus, and keep unrelated content fully visible.

## Tasks

- [ ] Add port and node hover relationships and source-port outlines.
- [ ] Prove the markup and verify browser hover, focus and empty-space behavior.

## Related

Stacked on [PR #3224](https://github.com/functionalscript/functionalscript/pull/3224).
