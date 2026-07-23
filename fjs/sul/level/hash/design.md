```ts
type LiteralLevel = {
    decode: (outputSymbol: bigint) => List<bigint>
    encode: (state: EncodeState) => (inputSymbol) => [bigint|undefined, EncodeState]
}

type ListEffect<O, T> = Effect<O, [T, ListEffect<T>] | undefined>

type HashDecode = <O>(outputSymbol: bigint) => ListEffect<O, bigint>

type HashEncodeState

type HashEncode =
    (state: HashEncodeState) =>
    (inputSymbol: bigint) =>
    readonly[
        ,
        bigint|undefined,
        HashEncodeState
    ]
```
