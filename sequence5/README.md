# Types

```ts
type Sequence<T> = 
    readonly T[] |
    Thunk<T> |

type Thunk<T> = () => Node<T>

type Node<T> =
    undefined |
    { readonly first: T, readonly tail: Sequence<T> } |
    readonly[Sequence<T>, Sequenct<T>]
```
