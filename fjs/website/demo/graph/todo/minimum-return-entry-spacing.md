## Keep recursion arrowheads apart at crowded destinations

**Priority:** P3
**Status:** open

### Problem

Return entries are distributed evenly over the destination height at
`(i + 1) / (n + 1)`, without a minimum vertical distance. In the RTTI
Evaluated EDAG value example at `f1aa22738`, 24 returns enter `_exp or`
about 13.6px apart. Normal arrowheads are 9px high; highlighted arrowheads
are 21px high, so a highlighted head can overlap a normal neighbour. A shorter node with
many returns could also overlap ordinary arrowheads.

The existing 30px minimum horizontal run before entry keeps arrowheads clear
of bends, but does not address this vertical crowding.

### Proposal

Give destination entries enough vertical space for ordinary and highlighted
arrowheads. Consider increasing the target height or distributing entries
across an explicit entry area. Preserve distinct routes, port/title tracing,
and routes outside node boxes.

### Validation

- Check Evaluated EDAG value with a highlighted return beside normal returns.
- Check a short destination with many incoming returns.
- Verify distinct entry points and no arrowhead overlap in light/dark themes.

### Related

- [Graph renderer](../module.f.mjs)
- [RTTI schema demo](../../../../rtti/schema-demo/module.f.mjs)
