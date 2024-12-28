# BigInt

Bun has a `bigint` size limitation. It's `1_048_575` bits (`1024 ** 2`) or `131_072` Bytes.

## Benchmarks

### newLog2 (32 based) versus others (2024/12/27)

|Framework|str bin  |str hex  |old log2 |log2    |
|---------|---------|---------|---------|--------|
|Bun      | 994.3296|458.6633 |1038.7439|669.9755|
|Deno 2   |1884.6942|485.5894 | 240.4493|143.2709|
|Deno 1   |1878.0000|494.0000 | 268.0000|168.0000|
|Node 23  |1855.9599|558.6656 | 241.5325|138.5897|
|Node 22  |1863.8143|533.0014 | 225.9727|121.1032|
|Node 20  |1938.3770|561.1601 | 253.4389|129.6232|
|Node 18  |1888.5652|590.6440 | 243.8712|134.0867|
|Node 16  |1901.8710|560.1892 | 339.8360|213.6341|

The new `log2` wins on Deno and Node (V8) but slightly loses on Bun (WebKit).

https://github.com/functionalscript/functionalscript/actions/runs/12521052013/job/34927599441?pr=346

**Browser Test**

[benchmark.html](./benchmark.html)

|Browser     |str bin|str hex|old log2|log2|
|------------|-------|-------|--------|----|
|Chrome,  AMD|   1298|    328|     623| 452|
|FireFox, AMD|   1797|    323|    1704|1267|

### Minus versus Not

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

## Old Benchmarks

### log2 versus toString (2024/11/25)

|Framework|log2(x)           |x.toString(2).length|
|---------|------------------|--------------------|
|Bun      |1.781681          |2.079615            |
|Deno 1   |0.710344          |1.917003            |
|Deno 2   |0.986602          |2.286932            |
|Node 16  |1.521150          |2.330505            |
|Node 18  |1.393006          |2.312573            |
|Node 20  |1.055315          |2.320039            |
|Node 22  |0.983075          |2.336697            |
|Node 23  |0.699960          |1.872965            |

`log2` wins.
