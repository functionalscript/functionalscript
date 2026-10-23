# Memo

The EDAG interpreter that remembers: within one call, each shared node is
evaluated once and its value reused, so a `const` read twice is computed once
and a shared `{}` is one object. [`module.f.mjs`](./module.f.mjs) holds it.

```js
import { identityAnalysis } from '../analysis/module.f.mjs'
import { unwrap } from '../../types/result/module.f.js'
import { memo } from './module.f.mjs'

// [o, o] with o = {}: one object node, reached twice.
const o = ['{}', []]
const [, value] = memo(unwrap(identityAnalysis(['[]', [o, o]])))({ args: [] })
value[1][0] === value[1][1] // true: one object
```

|Export              |Does                                                                   |
|--------------------|-----------------------------------------------------------------------|
|`memo(analysis)`    |interprets a whole analyzed graph, given the module's `args`           |
|`invoke`            |calls a represented function value, evaluating its body with a fresh cache|
|`invokeWith(runtime)`|`invoke`, with built-in members resolved through `runtime`            |

**The cache is per call.** Each invocation of a function starts an empty cache
and keeps its captures by identity, so two calls of one function build two
fresh objects, as JavaScript does.

**Tail calls run in place.** A call in tail position replaces the current
invocation, so a function that iterates by calling itself last holds one cache
and constant host stack.

**It runs the analysis, not the raw graph.** [`analysis`](../analysis/README.md)'s
`identityAnalysis`, the table the compiler gives it, finds the shared nodes once, so the interpreter needs no identity-keyed map of
its own.

[`amnesia`](../amnesia/README.md) is the other interpreter, which forgets, and
the demo on [`fjs/edag`](../README.md)'s page shows the two side by side.
The compiler uses `memo` to initialize modules, and NaNVM's value tests check
against it.
