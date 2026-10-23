# Mock runners

Synchronous runners for proofs: they perform an effect by calling a handler per
command and threading a state through, with no host at all.
[`module.f.mjs`](./module.f.mjs) holds them, and [`types.ts`](./types.ts) the
`MemOperationMap` handler shape.

```js
import { do_, pureOk, step } from '../module.f.mjs'
import { run } from './module.f.mjs'
import { ok } from '../../types/result/module.f.js'

const count = do_('count')
const twice = step(count(), a => step(count(), b => pureOk([a, b])))

// Each handler takes the payload, then the state, and answers [state, result].
run({ count: () => n => [n + 1, ok(n)] })(0)(twice) // [2, ['ok', [0, 1]]]
```

|Runner                    |Use it when                                                              |
|--------------------------|-------------------------------------------------------------------------|
|`run(handlers)`           |every operation the program can perform has a handler                    |
|`partialRun(commands)(handlers)`|some do not: a missing one answers `error(notImplemented(command))`|

A proof asserts on both halves of the answer: the final state says what the
program did, and the `Result` what it answered. The demo on
[`fjs/effects`](../README.md)'s page is a mock run whose state is the trace of
operations. For a program written against Node's operations,
[`node/virtual`](../node/virtual/README.md) is a ready-made mock with a file
system.
