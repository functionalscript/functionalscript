# Normal-result forwarding

`_forwardResult(statement)` consumes trusted normalized FAST. It removes one
exact forwarding layer:

```text
block [outer] {
    if [inner] (test) { then } else { otherwise }
    yield ref(inner)
}
```

becomes the same conditional with result binding `outer`. The block must have
one result, contain only that one-result conditional, and yield exactly its
result reference. Matching uses binding identity, not diagnostic indices.

The test and both arm blocks are reused unchanged. Branch declarations and
captures keep their scopes; return, break, continue and throw exits keep their
owners. No prefix work is lifted, no reference is substituted inside an arm,
and broader blocks return unchanged. Producer-established arities and lexical
legality remain the normalized input contract.

The common graph-to-FAST join walk and source-loop coordinator reuse this helper
after visiting children. Canonical independent-recipe selectors then reach the
existing source conditional and loop plans without a naked statement block.
This adds no source grammar or tail-call analysis. Genuine lazy placement and
nonlocal source restrictions retain their existing admission boundaries.
