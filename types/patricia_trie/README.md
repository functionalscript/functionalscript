# Patricia Trie

A streaming binary trie built from a **sorted** sequence of leaves. The branching structure is determined by the longest common bit-prefix of adjacent leaves. Each internal node is identified by combining the identities of its two children via a caller-supplied `Create<T>` function.

## How it works

Leaves must arrive in either strictly ascending or strictly descending order. The algorithm maintains a **right-spine stack** of open candidates. When a new leaf arrives, any two adjacent candidates that are more tightly coupled with each other than with the new leaf (measured by XOR of their sort keys) are merged — left and right identities are passed to `create`, producing a completed `Node`. The new leaf is then pushed as a fresh candidate.

### Merge condition

Two candidates with sort keys `lLeaf` and `rLeaf` are merged before adding new leaf `u` when:

```
(lLeaf XOR rLeaf) < (rLeaf XOR u)
```

A smaller XOR means a longer common bit-prefix, so this fires when the two existing candidates share more prefix bits with each other than `rLeaf` shares with `u`.

### Completing the tree

After all leaves have been pushed, `end` drains the remaining stack right-to-left, merging every pair until a single root identity remains.

## Types

```typescript
type Create<S, T> = (storage: S, a: T, b: T) => readonly[S, T]
type Candidate<T> = readonly [bigint, T]         // [sortKey, id]
type State<T>     = readonly Candidate<T>[]      // right-spine stack
```

`Create<S, T>` is the combining function. It receives the current storage `S`, the two child identities, and returns both the updated storage and the new parent identity. Passing `S = undefined` (and ignoring storage) gives the simple case where only the root hash is needed. Passing `S = readonly [T, T, T][]` accumulates every created node for later inspection or persistence.

`Candidate<T>` separates the `bigint` sort key (used only for XOR comparisons) from the opaque identity `T`. This lets `T` be a hash, a content address, a string, or any other type.

## API

```typescript
const { push, end } = patriciaTrie(create)
```

| | Signature | Description |
|---|---|---|
| `push` | `(storage: S) => StateScan<Candidate<T>, State<T>, S>` | Add one sorted leaf. Returns updated storage and new state. |
| `end` | `(storage: S) => (state: State<T>) => readonly [S, T \| undefined]` | Flush remaining candidates. Returns final storage and root identity (`undefined` if no leaves). |

Both functions are pure — `State<T>` is an immutable array and is never mutated.

## Example

See [example.md](example.md) for a full 16-leaf worked trace showing the state after each `push` and the resulting tree shape.

## Properties

- **Order-dependent identity**: ascending and descending insertion of the same leaf set produce trees with mirrored left/right children — root identities differ unless `create` is symmetric.
- **Incremental**: nodes are emitted as soon as they are complete; callers can store or transmit them without waiting for the full sequence.
- **Parameterised**: any `Create<T>` function can be supplied — a cryptographic hash, XOR, string concatenation, or a test stub.

## References

- Donald R. Morrison, [*PATRICIA — Practical Algorithm To Retrieve Information Coded in Alphanumeric*](https://dl.acm.org/doi/abs/10.1145/321479.321481), Journal of the ACM, 15(4):514–534, 1968.
- Wikipedia: [Radix tree](https://en.wikipedia.org/wiki/Radix_tree)
- NIST: [Patricia tree](https://xlinux.nist.gov/dads/HTML/patriciatree.html)