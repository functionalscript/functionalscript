# Expand named schemas in the RTTI graph

**Status:** wip

The RTTI graph stops at a nested named schema, hiding recursive lock maps,
JSON values and JSON Schema definitions inside the project's examples.

Expand every reachable named schema once by identity, preserving its name in
the node label. Shared uses point to that node; recursive uses draw back edges.
Built-in schemas and primitive constants remain inline. Reuse the shared graph
walk and routing, with an explicit opt-in for cycles described by node shapes.

## Tasks

- Expand named schemas and prove sharing, direct and mutual recursion.
- Check every RTTI example, record affected schemas in the PR description,
  and inspect the larger graphs in the browser.

## Related

Stacked on [PR #3207](https://github.com/functionalscript/functionalscript/pull/3207).
