# SUL Hash-Level Encoding

Encodes a stream of level-3 SUL symbols into level-4 hash symbols using a
Patricia trie and the 256-bit [SUL hash](../../hash/README.md).

## Background

The literal levels (0–3) use a bijective integer encoding whose alphabet grows
via tetration. Level 4 would have $2^{136}+1$ symbols — far too large to store
as an integer. This module replaces that bijection with content-addressed
256-bit hashes, enabling unbounded nesting at a fixed identifier size.

## Word structure

A valid word has the form `[s0, s1, ..., sk, t]` where:

- `s0 > s1 > ... > sk` — a strictly decreasing prefix of at least one symbol
- `t >= sk` — a terminating symbol no less than the last prefix element

See the [SUL overview](../../README.md) for full details.

## Encoding algorithm

A word `[s0, ..., sk, t]` encodes to a single hash-level symbol:

```
encode([s0, ..., sk, t]) = compress(trie([s0, ..., sk]), t)
```

where `trie([s0, ..., sk])` is the root of a Patricia trie built from the
decreasing prefix, and `compress` is the SUL hash merge function.

The Patricia trie produces a balanced binary hash tree from the prefix, so
the depth of merging is $O(\log k)$.

## Storage model

Every `compress(a, b)` call produces a merge triple `(a, b, merged)`. The
`Add<S>` callback is invoked once per triple, giving the caller full control
over how merges are persisted:

```typescript
type Add<S> = (left: bigint, right: bigint, merged: bigint, storage: S) => S
```

For a word with a $k$-element prefix, `add` is called $k$ times total:
$k - 1$ times during Patricia trie collapse and once for the final
`compress(root, t)`.

## Streaming usage

`encode(add)` returns a step function `(symbol, state) => [output, state]`
that processes one symbol at a time:

```typescript
const step = encode(add)
let state = emptyEncodeState(storage)

for (const symbol of word) {
    const [out, next] = step(symbol, state)
    state = next
    if (out !== undefined) {
        // word boundary reached; out is the hash-level symbol
    }
}
```

Output is `undefined` for every symbol in the decreasing prefix and becomes
a `bigint` exactly once — when the terminating symbol `t` is processed.
After each flush the stack is cleared; storage accumulates across words.
