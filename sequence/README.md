# Sequences

Sequence types:

- Sequence
- Array
- Iterable
- AsyncIterable

# Sequence Types

```ts
type Sequence<T> = 
    readonly T[] |
    Thunk<T> |

type Thunk<T> = () => Node<T>

type Node<T> =
    undefined |
    { readonly first: T, readonly tail: Sequence<T> } |
    readonly[Sequence<T>, Sequence<T>]
```

## Functions

See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array

- `length: Sequence<infer T> => number`
- `at: number => Sequence<infer T> = T|undefined`
- `concat: Sequence<infer T> => Sequence<T> => Sequence<T>`
- `entries: Sequence<infer T> => Sequence<[number, T]>`
- `every: (infer T => boolean) => Sequence<T> => boolean`
- `filter: (infer T => boolean) => Sequence<T> => Sequence<T>`
- `find: (infer T => boolean) => Sequence<T> => T`
- `findIndex: (infer T => boolean) => Sequence<T> => number`
- `flat: Sequence<Sequence<T>> => Sequence<T>`
- `flatMap: (infer T => Sequence<infer R>) => Sequence<T> => Sequence<R>`
- `includes: infer T => Sequence<T> => boolean`
- `indexOf: infer T => Sequence<T> => number`
- `join: string => Sequence<string> => string`
- `lastIndexOf: infer T => Sequence<T> => number`
- `map: (infer T => infer R) => Sequence<T> => Sequence<R>`
- `reduce: ...Scan<T, R> => Sequence<T> => R`
- `some: (infer T => boolean) => Sequence<T> => boolean`

### Priority 2.

- `slice: number => number => Sequence<T> => Sequence<T>`
- `reduceRight: ...Scan<T, R> => Sequence<T> => R`
- `toLocalString: Locales => Sequence<T> => string`

### Priority 3.

- `keys: Sequence<T> => Sequence<string>`
- `values: Sequence<infer T> => Sequence<T>`

## Prohibited Array Operations

- `copyWithin`
- `fill`
- `pop`
- `push`
- `reverse`
- `shift`
- `sort`
- `splice`
- `unshift`