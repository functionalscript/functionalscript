# Share recursion routes and trace connections

**Priority:** P3
**Status:** wip

## Problem

Fully expanded RTTI schemas have many parallel recursion routes. It is hard
to follow one use back to its definition in the Evaluated EDAG value example.

## Proposal

Opt the RTTI graph into shared return routes for back edges with the same
destination and edge kind. Keep each logical connection traceable: hovering,
clicking or keyboard-focusing its route highlights the complete path and both
endpoints. Click selection uses native focus; Tab moves between connections.
Other graph demos keep their current presentation.

## Tasks

- [ ] Share return lanes and destination arrowheads without crossing boxes.
- [ ] Add accessible hover and focus tracing, including click selection.
- [ ] Compare the large RTTI examples and check browser interactions.

## Related

Stacked on [PR #3208](https://github.com/functionalscript/functionalscript/pull/3208).
