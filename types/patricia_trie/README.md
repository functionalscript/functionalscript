# Merkle Patricia Trie

A streaming, content-addressed binary tree built from a **sorted** sequence of `bigint` leaves. The branching structure is determined by the longest common bit-prefix of adjacent leaves (Patricia), and every internal node carries a hash of its two children (Merkle).

## How it works

Leaves must arrive in either strictly ascending or strictly descending order. The algorithm maintains a **right-spine stack** of open candidates. When a new leaf arrives, any two adjacent candidates that are more tightly coupled with each other than with the new leaf (measured by XOR of their rightmost leaves) are merged — left hash and right hash are passed to `compress`, producing a completed `Node`. The new leaf is then pushed as a fresh candidate.

### Merge condition

Two candidates with rightmost leaves `lLeaf` and `rLeaf` are merged before adding new leaf `u` when:

```
(lLeaf XOR rLeaf) < (rLeaf XOR u)
```

A smaller XOR means a longer common bit-prefix, so this fires when the two existing candidates share more prefix bits with each other than `rLeaf` shares with `u`.

### Completing the tree

After all leaves have been pushed, `end` drains the remaining stack right-to-left, merging every pair until a single root hash remains.

## Types

```typescript
type Node      = readonly [bigint, bigint, bigint]  // [leftHash, rightHash, hash]
type Compress  = (a: bigint, b: bigint) => bigint
type Candidate = readonly [bigint, bigint]          // [rightmostLeaf, hash]
type State     = readonly Candidate[]               // right-spine stack
```

`Candidate` tracks the rightmost leaf of a subtree (used for XOR comparisons) and its accumulated hash (passed to `compress` when the candidate is merged).

## API

```typescript
const { push, end } = mpt(compress)
```

| | Signature | Description |
|---|---|---|
| `push` | `StateScan<bigint, State, readonly Node[]>` | Add one sorted leaf. Returns completed nodes and new state. |
| `end` | `(state: State) => readonly [readonly Node[], bigint \| undefined]` | Flush remaining candidates. Returns final nodes and root hash (`undefined` if no leaves). |

Both functions are pure — `State` is an immutable array and is never mutated.

## Example

See [example.md](example.md) for a full 16-leaf worked trace showing the state after each `push` and the resulting tree shape.

## Properties

- **Order-independent root**: ascending and descending insertion of the same leaf set produce trees with the same shape, but left/right children are mirrored — the root hashes differ unless `compress` is symmetric.
- **Incremental**: nodes are emitted as soon as they are complete; callers can store or transmit them without waiting for the full sequence.
- **Parameterised**: any `Compress` function can be supplied — SHA2-based, XOR, or a test stub.
