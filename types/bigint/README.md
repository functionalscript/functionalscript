# BigInt

Bun has a `bigint` size limitation. It's `1_048_575` bits (`1024 ** 2`) or `131_072` Bytes.

## Benchmarks

### bitLen vs toString(2).length (2024/11/25)

|Framework|bitLen            |toString(2).length|
|---------|------------------|------------------|
|Bun      |1.781681          |2.079615          |
|Deno 1   |0.710344          |1.917003          |
|Deno 2   |0.986602          |2.286932          |
|Node 16  |1.521150          |2.330505          |
|Node 18  |1.393006          |2.312573          |
|Node 20  |1.055315          |2.320039          |
|Node 22  |0.983075          |2.336697          |
|Node 23  |0.699960          |1.872965          |

`bitLen` wins.

### Minus vs Not

|Framework|minus `-`         |not `~`           |
|---------|------------------|------------------|
|Bun      |86.269967         | 80.372970        |
|Deno 1   |18.754810         | 59.498217        |
|Deno 2   |17.262486         | 57.157273        |
|Node 16  |70.350582         |121.023162        |
|Node 18  |61.039463         | 99.369215        |
|Node 20  |16.908695         | 63.335552        |
|Node 22  |19.546644         | 59.034978        |
|Node 23  |18.246697         | 58.825815        |

`-` wins.