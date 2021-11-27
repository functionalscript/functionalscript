# Operator

## Sequence

```ts
type Sequence<T> = SubSequence<T, undefined>
```

## SubSequence

```ts
type SubSequence<T, C> = () => SubSequenceResult<T, C>
type SubSequenceResult<T, C> = [T, SubSequence<T, C>] | [C]
```

## The Main FlatScan Operator

```ts
type FlatScanOperator<T, A> = (value: T) => SubSequence<A, FlatScanOp<T, A>>

const flatScanConcat
: SubSequence<A, FlatScanOp<T, A>> => Sequence<T> => Sequence<A>
=> a => b => () => {
    switch (next(a)) {
        case [first, tail]: { return [first, flatScanConcat(tail)(b)] }
        case [operator]: { return flatScan(operator)(b)() }
    }
}

const flatScan 
: FlatScanOperator<T, A> => Sequence<T> => Sequence<A>
=> operator => sequence => () => {
    // optimization for `takeWhile`, `find`
    if (operator === flatScanEmpty) { return [undefined] }
    //
    switch (next(s)) {
        case [first, tail]: { return flatScanConcat(operator(first))(tail)() }
        case [undefined]: { return [undefined] }        
    }
}
```