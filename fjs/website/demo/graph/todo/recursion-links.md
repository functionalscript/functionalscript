## Group recursion links

**Priority:** P3
**Status:** open

### Problem

EDAG and RTTI graphs use the shared graph renderer. Recursion links currently
take separate lanes below the entire graph and enter their destination at
separate points. This adds clutter at shared destinations, gives recursion
too much visual weight, and makes unrelated nodes above a return lane look
as though they belong to its cycle.

The old minimum-return-entry-spacing issue recorded a crowded RTTI Evaluated
EDAG value example at `f1aa22738`: highlighted arrowheads could overlap
neighbouring ordinary arrowheads. Bundling changes the desired solution;
keeping every return at a distinct entry point is no longer a requirement.

### Proposal

#### Share routes into the same destination

Recursion arrows targeting the same node should merge into a shared return
route where their paths can coincide. Keep individual source branches and
port identities; share the trunk, destination entry, and arrowhead. Links to
different destinations remain separate. A crossing alone is not a merge.

Each shared segment retains the identities of all connections using it.
Hovering that segment highlights the union of their complete arrows, source
ports or title blocks, and destination title blocks, exactly as hovering each
connection separately would. Hovering an individual branch or source port
highlights just that connection. As a branch joins a trunk, the highlighted
set follows the connections present at that segment.

SVG stacking must not decide which connection wins: overlapping independent
hit paths currently expose only the topmost path. Give shared segments an
explicit hit target and connection membership, or an equivalent mechanism
that reliably selects the whole set. Retain individual keyboard focus and
connection descriptions even when their visible geometry is shared. Target
title hover should retain its existing incoming-connection behavior.

#### Make recursion visually secondary

Choose the final style during implementation. Start by comparing a fine
dotted line and a short-dash pattern with a muted stroke and small arrowhead.
Keep enough contrast in both themes and retain an easy-to-hit invisible
stroke. Hover and keyboard focus should make the whole selected connection
clear, including its direction and endpoints.

Recursion must remain distinguishable from lazy operands, which already use
a dashed line. Treat recursion styling independently of `Edge.kind`, so a
link can communicate both recursion and laziness without losing either.
The weaker appearance describes visual priority, not optional evaluation.

#### Keep cycles together

Determine cycle membership from graph connectivity, including back edges,
before placing nodes. Strongly connected components are a starting point:
they group mutually reachable nodes, including a self-loop, without pulling
in one-way dependencies. Overlapping cycles share a component; do not assign
a shared node to several conflicting layout groups or duplicate it.

Pack each cyclic component into a compact region, reserving local routing
space inside that region for its recursion links. Place unrelated nodes
outside it. Simply moving a bottom lane upward is insufficient if unrelated
nodes still sit between the cycle's members. Keep edges clear of node boxes,
labels, and ports, and preserve forward-edge direction and shared-node
identity. Coordinate component placement with existing rank-skipping lanes
and column centering rather than routing through their occupied space.

Cycle grouping is distinct from lexical function scope: an acyclic helper
inside a function does not become a cycle member. A subtle background or
outline may help communicate a component, but decide this during visual
review; spacing and local routes should already make membership clear.

### Additional improvements to consider

- When inputs change, avoid unnecessary graph rearrangement and keep keyboard
  focus on the same connection if it still exists.

### Tasks

- [ ] Identify the nodes in each cycle and arrange them together, keeping
  unrelated nodes outside. Check this with EDAG and RTTI examples.
- [ ] Route recursion within component regions and bundle returns by target,
  retaining original edge identities and source-port tracing.
- [ ] Implement segment-aware union highlighting and preserve individual
  keyboard access without relying on SVG paint order.
- [ ] Compare recursion styles in light/dark themes, including lazy recursion,
  and choose the final stroke, markers, and interaction treatment.
- [ ] Update renderer/API documentation and demo descriptions that currently
  promise separate bottom lanes and distinct entries for every return.

### Validation

- Several recursion links to one target: one shared entry; hovering a trunk
  selects every contributing connection; hovering a branch selects only it.
- Partial overlaps and crossings: membership changes at joins, crossings
  remain separate, and highlights do not flicker at segment boundaries.
- Direct self-recursion, mutual recursion, overlapping cycles, separate
  cycles, and nested functions capturing an outer recursive function.
- An unrelated tall branch beneath a cycle: it stays outside the cycle's
  region, and the return no longer detours below the whole graph.
- Crowded RTTI Evaluated EDAG value and a short target with many returns:
  normal and highlighted markers stay clear of other routes and node text.
- Mouse hover, keyboard focus, light/dark themes, and ordinary acyclic graphs;
  verify forward routes still avoid boxes and shared nodes still appear once.

### Related

- [Graph renderer](../module.f.mjs) and [graph API](../types.ts).
- [Graph stylesheet](../../../style/module.f.js).
- [EDAG graph demo](../../../../compiler/edag/demo.f.mjs).
- [EDAG recursion proofs](../../../../compiler/edag/recursion.proof.f.mjs).
- [RTTI schema demo](../../../../rtti/schema-demo/module.f.mjs).
- [EDAG computation graph visualizer](../../../../edag/todo/graph-visualizer.md)
  — the broader Mermaid/DOT proposal; this issue concerns the shared SVG view.
