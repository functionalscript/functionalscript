# B-tree

https://en.wikipedia.org/wiki/B-tree

## BTree 2-3 nodes

`Node<T>`:

- leaf1: `[T]`
- leaf2: `[T,T]`
- branch3: `[Node<T>, T, Node<T>]`
- branch5: `[Node<T>, T, Node<T>, T, Node<T>]`

## Result Types

`Result<T>`:

- { done: `true`, value: `T`,  } |
  { done: `false` }
- { replace: `Node<T>` }
- { overflow: `Branch3<T>` }

## Actions

- found (6 functions)
  - leaf1: `0`
  - leaf2: `0 1`
  - branch3: `1`
  - branch5: `1 3`
- notFound (5 functions)
  - leaf1: `left right`
  - leaf2: `left middle right`

|type   |found|notFound           |
|-------|-----|-------------------|
|leaf1  |`0`  |`left right`       |
|leaf2  |`0 1`|`left middle right`|
|branch3|`1`  |_left right_       |
|branch5|`1 3`|_left middle right_|

Note: 5 transitional states:
- branch3: _left right_
- branch5: _left middle right_

Posible actions:

- found. It can return:
  - get: { done: `true` ... }
  - replace: { replace: ... }
- notFound:
  - none: { done: `false` }
  - insert: { replace: ... } | { overflow: ... }

|               |found.get  |found.replace  |
|---------------|-----------|---------------|
|notFound.none  |get        |replace        |
|notFound.insert|getOrInsert|replaceOrInsert|

## Branch3 Overflow

- current `[n0 v1 n2]`
- overflow `[L VM R]`

|type  |index|{ replace: Branch5 }|
|------|-----|--------------------|
|left  |    0|`[(L VM R) v1 n2]`  |
|right |    2|`[n0 v1 (L VM R)]`  |

## Branch5 Overflow

- current `[n0, v1, n2, v3, n4]`
- overflow `[L, VM, R]`

|type  |index|Operation           |Branch7                 |{ overflow: Branch3 }       |
|------|-----|--------------------|------------------------|----------------------------|
|left  |    0|`[...o v1 n2 v3 n4]`|`[(L VM R) v1 n2 v3 n4]`|`[[ L VM R ] v1 [n2 v3 n4]]`|
|middle|    2|`[n0 v1 ...o v3 n4]`|`[n0 v1 (L VM R) v3 n4]`|`[[n0 v1 L ] VM [ R v3 n4]]`|
|right |    4|`[n0 v1 n2 v3 ...o]`|`[n0 v1 n2 v3 (L VM R)]`|`[[n0 v1 n2] v3 [ L VM R ]]`|

## Deleting a Node

|type              |index|                    |        |                             |
|------------------|-----|--------------------|--------|-----------------------------|
|`[v]`             |    0|                    |        |underflow `undefined`        |
|`[v0,v1]`         |    0|                    |        |replace `[v1]`               |
|                  |    1|                    |        |replace `[v0]`               |
|`[n0,v1,n2]`      |    1|`merge(n0,n2)`      |overflow|replace `[n0_,v1_,n1_]`      |
|                  |     |                    |replace |underflow `n_`               |
|`[n0,v1,n2,v3,n4]`|    1|`merge(n0,n2),v3,n4`|overflow|replace `[n0_,v1_,n1_,v3,n4]`|
|                  |     |                    |replace |replace `[n_,v3,n4]`         |
|                  |    3|`n0,v1,merge(n2,n4)`|overflow|replace `[n0,v1,n0_,v1_,n1_]`|
|                  |     |                    |replace |replace `[n0,v1,n_]`         |

### Underflow

|type              |index|                                       |                                               |
|------------------|-----|---------------------------------------|-----------------------------------------------|
|`[n0,v1,n2]`      |    0|`[[],v1,[v20]]`                        |underflow `[v1,v20]`                           |
|                  |     |`[[],v1,[v20,v21]]`                    |replace `[[v1],v20,[v21]]`                     |
|                  |     |`[[n_],v1,[n20,v21,n22]]`              |underflow `[n_,v1,n20,v21,n22]`                |
|                  |     |`[[n_],v1,[n20,v21,n22,v23,n24]]`      |replace `[[n_,v1,n20],v21,[n22,v23,n24]]`      |
|                  |    2|                                       |                                               |
|`[n0,v1,n2,v3,n4]`|    0|`[[],v1,[v20],v3,n4]`                  |replace `[[v1,v20],v3,n4]`                     |
|                  |     |`[[],v1,[v20,v21],v3,n4]`              |replace `[[v1],v20,[v21],v3,n4]`               |
|                  |     |`[[n_],v1,[n20,v21,n22],v3,n4]`        |replace `[[n_,v1,n20,v21,n22],v3,n4]`          |
|                  |     |`[[n_],v1,[n20,v21,n22,v23,n24],v3,n4]`|replace `[[n_,v1,n20],v21,[n22,v23,n24],v3,n4]`|
|                  |    2|                                       |                                               |
|                  |    4|                                       |                                               |

## Merge (n0,n1)

`merge` returns either `overflow 3` or `replace`:
- `overflow 3`: `[n0,v1,n2]`
- `replace`: `n`

|`n0`                   |`n1`                   |                                                |
|-----------------------|-----------------------|------------------------------------------------|
|`[v00]`                |`[v10]`                |replace  `[v00,v10]`                            |
|                       |`[v10,v11]`            |overflow `[[v00],v10,[v11]]`                    |
|`[v00,v01]`            |`n1`                   |overflow `[[v00],v01,n1]`                       |
|`[n00,v01,n02]`        |`[n10,v11,n12]`        |`n00,v01,merge(n02,n10),v11,n12`                |
|                       |`[n10,v11,n12,v13,n14]`|`n00,v01,merge(n02,n10),v11,n12,v13,n14`        |
|`[n00,v01,n02,v03,n04]`|`[n10,v11,n12]`        |`n00,v01,n02,v03,merge(n04,n10),v11,n12`        |
|                       |`[n10,v11,n12,v13,n14]`|`n00,v01,n02,v03,merge(n04,n10),v11,n12,v13,n14`|

### Replace

- `n0,v1,merge(n2,n3),v4,n5`: replace `[n0,v1,n,v2,n3]`
- `n0,v1,merge(n2,n3),v4,n5,v6,n7`: overflow `[[n0,v1,n],v4,[n5,v6,n7]]`
- `n0,v1,n2,v3,merge(n4,n5),v6,n7`: overflow `[[n0,v1,n2],v3,[n,v6,n7]]`
- `n0,v1,n2,v3,merge(n4,n5),v6,n7,v8,n9`: overflow `[[n0,v1,n2],v3,[n,v6,n7,v8,n9]]`

### Overflow 3

- `n0,v1,merge(n2,n3),v4,n5`: overflow `[[n0,v1,mn0],mv1,[mn2,v4,n5]]`
- `n0,v1,merge(n2,n3),v4,n5,v6,n7`: overflow `[[n0,v1,mn0],mv1,[mn2,v4,n5,v6,n7]]`
- `n0,v1,n2,v3,merge(n4,n5),v6,n7`: overflow `[[n0,v1,n2,v3,mn0],mv1,[mn2,v6,n7]]`
- `n0,v1,n2,v3,merge(n4,n5),v6,n7,v8,n9`: overflow `[[n0,v1,n2,v3,mn0],mv1,[mn2,v6,n7,v8,n9]]`