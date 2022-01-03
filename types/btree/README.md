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

## Concat

`concat` returns either `Branch1` or `Branch3`

|`a`               |`b`                |                                                 |size |
|------------------|-------------------|-------------------------------------------------|-----|
|`[av]`            |`[bv]`             |`[[av,bv]]`                                      |     |
|                  |`[bv0,bv1]`        |`[a,bv0,[bv1]]`                                  |     |
|`[av0,av1]`       |                   |`[[av0],av1,b]`                                  |     |
|`[...aHead,aLast]`|`[bFirst,...bLast]`|`up([...aHead,...concat(aLast,bFirst),...bTail])`|5..11|

## Up

`up` returns `Branch1` or `Branch3`

|`n.lenght`|                          |
|----------|--------------------------|
|5         |`[n]`                     |
|7         |`[n[0...2],n[3],n[4...6]]`|
|9         |`[n[0...2],n[3],n[4...8]]`|
|11        |`[n[0...4],n[5],n[6...A]]`|

## Delete

`delete` returns `['leaf', [] | Leaf1]` | `['branch', Branch1 | Branch3 | Branch5]`

|type              |index|r                                |
|------------------|-----|---------------------------------|
|`[v]`             |    0|leaf `[]`                        |
|`[v0,v1]`         |    0|leaf `[v1]`                      |
|                  |    1|leaf `[v2]`                      |
|`[n0,v1,n2]`      |    1|branch `concat(n0,n2)`           |
|`[n0,v1,n2,v3,n4]`|    1|branch `[...concat(n0,n2),v3,n4]`|
|                  |    3|branch `[n0,v1,...concat(n2,n4)]`|

|type              |index|nR     |                                        |
|------------------|-----|-------|----------------------------------------|
|`[n0,v1,n2]`      |    0|`[]`   |`[[v1, v20]]`                           |
|                  |     |       |`[[v1],v20,[v21]]`                      |
|                  |     |`[nR0]`|`[[nR0, v1, n20, v21, n22]]`            |
|                  |     |       |`[[nR0, v1, n20], v21, [n22, v23, n23]]`|
|                  |     |`nR`   |`[nR,v1,n2]`                            |
|                  |    2|`[]`   |`[[v00, v1]]`                           |
|                  |     |       |`[[v00],v01,[v1]]`                      |
|                  |     |`[nR0]`|`[[n00, v01, n02, v1, nR0]]`            |
|                  |     |       |`[[n00, v01, n02], v02, [n03, v1, nR0]]`|
|                  |     |`nR`   |`[n0,v1,nR]`                            |
|`[n0,v1,n2,v3,n4]`|    0|`[]`   |`[[v1,v20],v3,n4]`                      |
|                  |     |       |`[[v1],v20,[v21],v3,n4]`                |
|                  |     |`[nR0]`|`[[nR0,v1,n20,v21,n22],v3,n4]`          |
|                  |     |       |`[[nR0,v1,n20],v21,[n22,v23,n24],v3,n4]`|
|                  |     |`nR`   |`[nR,v1,n2,v3,n4]`                      |
|                  |    2|`[]`   |`[[v00,v1],v3,n4]`                      |
|                  |     |       |`[[v00],v01,[v1],v3,n4]`                |
|                  |     |`[nR0]`|`[[n00,v01,n02,v1,nR0],v3,n4]`          |
|                  |     |       |`[[n00,v01,n02],v03,[n04,v1,nR0],v3,n4]`|
|                  |     |`nR`   |`[n0,v1,nR,v2,n4]`                      |
|                  |    4|`[]`   |`[n0,v1,[v20,v3]]`                      |
|                  |     |       |`[n0,v1,[v20],v21,[v3]]`                |
|                  |     |`[nR0]`|`[n0,v1,[n20,v21,n22,v3,nR0]]`          |
|                  |     |       |`[n0,v1,[n20,v21,n22],v23,[n24,v3,nR0]]`|
|                  |     |`nR`   |`[n0,v1,n2,v3,nR]`                      |

## Insert

`insert` returns `Branch1` or `Branch3`

|type              |                                 |size|
|------------------|---------------------------------|----|
|`[v]`             |`[[vI,v]]`                       |    |
|                  |`[[v,vI]]`                       |    |
|`[v0,v1]`         |`[[vI],v0,[v1]]`                 |    |
|                  |`[[v0],vI,[v1]]`                 |    |
|                  |`[[v0],v1,[vI]]`                 |    |
|`[n0,v1,n2]`      |`up([...insert(n0),v1,n2])`      |3..5|
|                  |`up([n0,v1,...insert(n2)])`      |3..5|
|`[n0,v1,n2,v3,n4]`|`up([...insert(n0),v1,n2,v3,n4])`|5..7|
|                  |`up([n0,v1,...insert(n2),v3,n4])`|5..7|
|                  |`up([n0,v1,n2,v3,...insert(n4)])`|5..7|
