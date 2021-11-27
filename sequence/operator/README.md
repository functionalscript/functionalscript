# Sequence Operators

## A `FlatMap` Operator

`flatMap = combine(flat)(map)`

## A `Scan` Operator

```ts
type Scan<A, T> = (accumulator: A) => (value: T) => A
type ExclusiveScan<A, T> = [first, Scan<A, T>]
```

`scan`

`reduce = last(first)(scan)`

An alternative definition of a scan:

```ts
type Scan2<A, T> = (value: T) => [A, Scan2<A, T>]
type ExclusiveScan2<A, T> = [first, Scan2<A, T>]
```

`takeWhile`, `find` can use `scan`. Optimization: if a `Scan2` part is `emptyScan` then we can stop searching.

## A Universal Operator `FlatScan`

```ts
type FlatScan<A, T> = (value: T) => FlatScanSequence<A, T>
type FlatScanSequence<A, T> = () => FlatScanResult<A, T>
type FlatScanResult<A, T> =
    ['value', A, FlatScanSequence<A, T>] | 
    ['novalue', FlatScan<A, T>]
```

Optimization: if result is `empty`, then we can stop.

```ts
const empty = ['novalue', () => empty]
```
