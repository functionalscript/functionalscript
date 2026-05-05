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
import { encode, emptyEncodeState } from './module.f.ts'
import type { Add } from './level/hash/module.f.ts'

const enc = encode(add)              // add: Add<S> — called on every merge
let state = emptyEncodeState(storage)

for (const bit of bits) {
    state = enc.push(bit, state)     // bit is 0n or 1n
}
const root: Id = enc.end(state)      // flush and return the root Id
```

| Export                      | Description                                                        |
|-----------------------------|--------------------------------------------------------------------|
| `encode(add)`               | Creates an encoder for a given storage backend                     |
| `emptyEncodeState(storage)` | Initial state wrapping a storage value                             |
| `Encode<S>`                 | Encoder with `push` and `end` methods                              |
| `EncodeState<S>`            | Opaque streaming state (three literal levels + dynamic hash stack) |

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
