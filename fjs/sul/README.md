# Synthetic Universal Language (SUL)

SUL is a universal encoding that bijectively maps any finite sequence of symbols to a single root symbol via a balanced tree, from which the original sequence can be uniquely recovered.

## Concepts

- A **symbol** is an element of a level's finite alphabet `[0, n)`.
- A **word** is a finite sequence of symbols that encodes into a single symbol of the next level.
- A **level** defines a finite alphabet `[0, n)` and the bijection between words over that alphabet and symbols of the next level.

## Word structure

A valid word has the form `[s0, s1, ..., sk, t]` where:

- `s0 > s1 > ... > sk` — a strictly decreasing prefix of at least one symbol
- `sk <= t` — a terminating symbol no less than the last prefix element

The minimum word length is 2: one prefix symbol is required to provide a value to compare against `t`, ensuring each word collapses to a single symbol at the next level — so the sequence strictly shrinks at every step and converges to a single root symbol in a finite number of levels.

## API

The top-level encoder accepts a stream of bits and produces a single [`Id`](id/README.md):

```ts
import { encode } from './module.f.mjs'
import { run } from '../types/list/module.f.mjs'
import type { Add } from './level/hash/types.ts'

const enc = encode(add)(storage)     // add: Add<S> — called on every merge
const root: Id = run(enc)(bits)      // consume 0n/1n bits, pad, return the root
```

| Export                      | Description                                                        |
|-----------------------------|--------------------------------------------------------------------|
| `encode(add)(storage)`      | Creates an encoder with the given initial storage                  |
| `Encode<S>`                 | Shared `Transducer` lifecycle, plus `updateWithHeight` and `endWithHeights`, which also give each bit's height |
| `EncodeState<S>`            | Opaque streaming state (three literal levels + dynamic hash stack) |

`init` is a `next` step holding the initial state. `update(state, bit)` returns
a new `next` step; `end(state)` pads with `1`, then `0`s, and returns a `done`
step holding the root. No items are emitted before completion. The common
driver handles these steps, and a caller can save a step's state and resume it.

A bit's **height** is how many levels close a word on it, counting up from L1: 0 for none, 2 for L1 and L2, 5 for L1
to H2. `updateWithHeight(state, bit)` returns it with the next state, and
`endWithHeights(state)` returns it for each padding bit with the root. These
additional observations share the lifecycle's encoding and padding operations.
The [demo](demo.f.mjs) draws its stripes from these heights.

The `Add<S>` callback is invoked once per `compress(left, right)` merge. `isSymbol` is `true` for the terminal merge
that produces a hash-level output symbol and `false` for Patricia trie internal merges.

## Architecture

Bits flow through four stages in sequence:

```
bits → L1 → L2 → L3 → Hash[0] → Hash[1] → … → Id
```

The hash stack grows dynamically: each time a hash level emits a symbol, it is pushed into the next level (created on demand).

## Sub-modules

- [level/](level/README.md) — level hierarchy: literal and hash levels
- [id/](id/README.md) — 256-bit content-addressed identifier
