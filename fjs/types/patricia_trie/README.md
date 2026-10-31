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
import { run } from '../list/module.f.js'

const machine = patriciaTrie(create)(storage)
const [root, finalStorage] = run(machine)(leaves)
```

The constructed machine implements the shared `Transducer` lifecycle:

| Operation | Result | Description |
| --- | --- | --- |
| `init` | `['next', [], state]` | Initial state wrapping the supplied storage and an empty right spine. |
| `update(state, candidate)` | `['next', [], state]` | Adds one leaf and returns the updated state. |
| `end(state)` | `['done', [], [root, storage]]` | Drains remaining candidates, returning the root (`undefined` for no leaves) and final storage. |

All operations are pure: `State<S, T>` is never mutated in place, so a saved
state can be resumed or finalized without changing another run. The machine
emits no items; its terminal summary carries the root and final storage.

## Example

See [example.md](example.md) for a full 16-leaf worked trace showing the state after each leaf and the resulting tree shape.

## Properties

- **Order-dependent identity**: ascending and descending insertion of the same leaf set produce trees with mirrored left/right children — root identities differ unless `create` is symmetric.
- **Incremental**: `create` receives a node as soon as it is complete, so a caller's storage backend need not wait for the full sequence.
- **Parameterised**: any `Create<S, T>` function can be supplied — a cryptographic hash, XOR, string concatenation, or a test stub.

## References

- Donald R. Morrison, [PATRICIA — Practical Algorithm To Retrieve Information Coded in Alphanumeric](https://dl.acm.org/doi/abs/10.1145/321479.321481), Journal of the ACM, 15(4):514–534, 1968.
- Wikipedia: [Radix tree](https://en.wikipedia.org/wiki/Radix_tree)
- NIST: [Patricia tree](https://xlinux.nist.gov/dads/HTML/patriciatree.html)
