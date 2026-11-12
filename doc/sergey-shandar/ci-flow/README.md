# CI Flow

eDSL to describe data transformation. It can be based on the flow idea.

Essentially, it's a DAG of transformations.

Each node is a function.

Each function can be split into embedded DAG.

When a function receives an input, it may request for additional inputs to continue

## Example

```
source.f.js-> [parser] -source.f.js AST-> [deps] -> source + requirements -> [loader]
```

## Builds

- Builds should be signed.
- Everything is content-addressable and dependencies are resolved into hashes.
