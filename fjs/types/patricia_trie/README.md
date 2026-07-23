# Patricia Trie

A streaming binary trie built from a sequence of leaves. The branching structure is determined by the longest common bit-prefix of adjacent leaves. Each internal node is identified by combining the identities of its two children via a caller-supplied `create` function.

## How it works

The algorithm maintains a **right-spine stack** of open candidates. When a new leaf arrives, any two adjacent candidates that are more tightly coupled with each other than with the new leaf (measured by XOR of their sort keys) are merged — left and right identities are passed to `create`, producing a completed node. The new leaf is then pushed as a fresh candidate.

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
type Create<S, T>    = (a: T, b: T, storage: S) => readonly[T, S]
type Candidate<T>    = readonly[bigint, T]           // [sortKey, id]
type State<S, T>     = readonly[S, readonly Candidate<T>[]]  // [storage, right-spine stack]
```

`Create<S, T>` is the combining function. It receives the two child identities and the current storage, and returns the new parent identity together with the updated storage. Values come first, storage last — both in the parameters and in the return tuple. Passing `S = undefined` (and ignoring storage) gives the simple case where only the root hash is needed.

`Candidate<T>` separates the `bigint` sort key (used only for XOR comparisons) from the opaque identity `T`. This lets `T` be a hash, a content address, a string, or any other type.

`State<S, T>` bundles storage and the right-spine stack into a single value, making it easy to thread state through a fold without tracking them separately.

## API

```typescript
const { push, end } = patriciaTrie(create)
```

|              | Signature                                              | Description                                                                                                 |
|--------------|--------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| `push`       | `(c: Candidate<T>, state: State<S, T>) => State<S, T>` | Add one leaf. Returns updated state (storage + stack).                                                      |
| `end`        | `(state: State<S, T>) => readonly[T \| undefined, S]`  | Flush remaining candidates. Returns root identity (`undefined` if no leaves were pushed) and final storage. |
| `emptyState` | `<S>(storage: S) => State<S, never>`                   | Construct the initial state from a storage value.                                                           |

Both `push` and `end` are pure — `State<S, T>` is never mutated in place.

## Example

See [example.md](example.md) for a full 16-leaf worked trace showing the state after each `push` and the resulting tree shape.

## Properties

- **Order-dependent identity**: ascending and descending insertion of the same leaf set produce trees with mirrored left/right children — root identities differ unless `create` is symmetric.
- **Incremental**: nodes are emitted as soon as they are complete; callers can store or transmit them without waiting for the full sequence.
- **Parameterised**: any `Create<S, T>` function can be supplied — a cryptographic hash, XOR, string concatenation, or a test stub.

## References

- Donald R. Morrison, [*PATRICIA — Practical Algorithm To Retrieve Information Coded in Alphanumeric*](https://dl.acm.org/doi/abs/10.1145/321479.321481), Journal of the ACM, 15(4):514–534, 1968.
- Wikipedia: [Radix tree](https://en.wikipedia.org/wiki/Radix_tree)
- NIST: [Patricia tree](https://xlinux.nist.gov/dads/HTML/patriciatree.html)
