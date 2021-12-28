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

|type              |index|                     |        |                             |
|------------------|-----|---------------------|--------|-----------------------------|
|`[v]`             |    0|                     |        |underflow `undefined`        |
|`[v0,v1]`         |    0|                     |        |replace `[v1]`               |
|                  |    1|                     |        |replace `[v0]`               |
|`[n0,v1,n2]`      |    1|`concat(n0,n2)`      |overflow|replace `[n0_,v1_,n1_]`      |
|                  |     |                     |replace |underflow `n_`               |
|`[n0,v1,n2,v3,n4]`|    1|`concat(n0,n2),v3,n4`|overflow|replace `[n0_,v1_,n1_,v3,n4]`|
|                  |     |                     |replace |replace `[n_,v3,n4]`         |
|                  |    3|`n0,v1,concat(n2,n4)`|overflow|replace `[n0,v1,n0_,v1_,n1_]`|
|                  |     |                     |replace |replace `[n0,v1,n_]`         |

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

## Concat (n0,n1)

`concat` returns either `Branch1` or `Branch3`

|`a`               |`b`                |                                                 |
|------------------|-------------------|-------------------------------------------------|
|`[av]`            |`[bv]`             |`[[av,bv]]`                                      |
|                  |`[bv0,bv1]`        |`[a,bv0,[bv1]]`                                  |
|`[av0,av1]`       |                   |`[[av0],av1,b]`                                  |
|`[...aHead,aLast]`|`[bFirst,...bLast]`|`up([...aHead,...concat(aLast,bFirst),...bTail])`|

## Up

|`n`      |                        |
|---------|------------------------|
|`[...n4]`|`[n]`                   |
|`[...n6]`|`[[...n2],v3,[n4...n6]]`|
|`[...n8]`|`[[...n2],v3,[n4...n8]]`|
|`[...nA]`|`[[...n4],v5,[n6...nA]]`|
