# BigInt

Bun has a `bigint` size limitation. It's `1_048_575` bits (`1024 ** 2`) or `131_072` Bytes.

## Benchmarks

### New log2 based on `Math.log2` and str32Log2 (2025/01/10)

For big numbers, about `2 ** 1_000_000`:

|Framework|strBinLog2|strHexLog2|str32Log2|oldLog2|clz32Log2|   log2|
|---------|----------|----------|---------|-------|---------|-------|
|Bun      |      2071|       731|  **631**|   1827|     1195|   1110|
|Deno 2   |      3720|       970|      788|    506|      307|**206**|
|Deno 1   |      3710|       966|      782|    488|      292|**204**|
|Node 23  |      3803|      1073|      947|    534|      317|**226**|
|Node 22  |      3882|      1073|      967|    479|      265|**222**|
|Node 20  |      3855|      1118|      992|    494|      280|**217**|
|Node 18  |      3832|      1179|     1058|    514|      280|**229**|
|Node 16  |      3781|      1118|     1037|    672|      430|**281**|

For small numbers, `1 .. 2 ** 2_000`:

|Framework|strBinLog2|strHexLog2|str32Log2|oldLog2|clz32Log2|    log2|
|---------|----------|----------|---------|-------|---------|--------|
|Bun      |      2539|      1353|     1293|   3733|     1885| **699**|
|Deno 2   |      3067|       975|      791|   1662|      877| **452**|
|Deno 1   |      3052|       988|      828|   1656|      856| **456**|
|Node 23  |      3046|      1047|      898|   1795|      926| **538**|
|Node 22  |      3128|      1049|      878|   1845|      932| **500**|
|Node 20  |      3095|      1088|      935|   1796|      940| **566**|
|Node 18  |      3399|      1506|     1391|   4497|     2305| **970**|
|Node 16  |      3368|      1561|     1427|   4916|     2593|**1069**|

**Browser Test**

For big numbers, about `2 ** 1_000_000`:

|Browser|CPU|strBinLog2|strHexLog2|str32Log2|oldLog2|clz32Log2|   log2|
|-------|---|----------|----------|---------|-------|---------|-------|
|Chrome |AMD|      2360|       715|  **532**|   1190|      807|    551|
|Chrome | M1|      1235|       349|      283|    324|      226|**171**|
|Firefox|AMD|      3189|       588|  **529**|   2912|     2165|   1443|
|Firefox| M1|      1516|       401|  **338**|   1799|     1339|    847|
|Safari | M1|      1650|       369|      299|    318|      215|**203**|

For small numbers, `1 .. 2 ** 2_000`:

|Browser|CPU|strBinLog2|strHexLog2|str32Log2|oldLog2|clz32Log2|   log2|
|-------|---|----------|----------|---------|-------|---------|-------|
|Chrome |AMD|      2010|       889|      781|   2295|     1210|**593**|
|Chrome | M1|
|Firefox|AMD|      2117|       985|     1056|   2467|     1263|**503**|
|Firefox| M1|
|Safari | M1|

**Note:** the benchmark was changed since 2024 and runs more tests.
Compare only relative numbers.

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

|Browser|CPU|str bin|str hex|old log2|log2|
|-------|---|-------|-------|--------|----|
|Chrome |AMD|   1214|    334|     532| 369|
|Chrome | M1|    673|    176|     162| 106|
|Firefox|AMD|   1797|    323|    1704|1267|
|Firefox| M1|    788|    201|     910| 683|
|Safari | M1|    712|    180|     160| 106|

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
