# Memory effects

Typed mutable slots for an effectful program: `create` a slot with a value,
then `read` and `write` it in later steps. A slot's key carries its value type,
so a key made for a number can only be read as a number.
[`module.f.mjs`](./module.f.mjs) holds the operations and the synchronous
interpreter, and [`types.ts`](./types.ts) the `Key<T>` and `MemOp` types.

```js
import { mapStep, step } from '../module.f.mjs'
import { run } from '../mock/module.f.mjs'
import { create, memoryInitial, memoryOperationMap, read, write } from './module.f.mjs'

const counter = step(create(0), key =>
    step(write(key, 41), () =>
        mapStep(read(key), n => n + 1)))

run(memoryOperationMap)(memoryInitial)(counter)
// [{ next: 1, values: { mem0: 41 } }, ['ok', 42]]
```

The program stays pure: the slot lives in the runner's state, not in the
program. `memoryOperationMap` is the interpreter for
[`mock`](../mock/README.md)'s `run`, and
[`node/memory`](../node/memory/types.ts) the one for the Node runner. A
program that also does I/O unions the operation types,
`Effect<IoOp | MemOp, T, E>`.
