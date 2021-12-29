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

|`a`               |`b`                |                                                 |
|------------------|-------------------|-------------------------------------------------|
|`[av]`            |`[bv]`             |`[[av,bv]]`                                      |
|                  |`[bv0,bv1]`        |`[a,bv0,[bv1]]`                                  |
|`[av0,av1]`       |                   |`[[av0],av1,b]`                                  |
|`[...aHead,aLast]`|`[bFirst,...bLast]`|`up([...aHead,...concat(aLast,bFirst),...bTail])`|

## Up

`up` returns `Branch1` or `Branch3`

|`n.lenght`|                          |
|----------|--------------------------|
|5         |`[n]`                     |
|7         |`[n[0...2],n[3],n[4...6]]`|
|9         |`[n[0...2],n[3],n[4...8]]`|
|A         |`[n[0...4],n[5],n[6...A]]`|

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

|type              |index|nR    |                                    |size                 |      |
|------------------|-----|------|------------------------------------|---------------------|------|
|`[n0,v1,n2]`      |    0|leaf  |`vUp([...vR, v1, ...n2])`           |0+1+1...2+1+2        |2...5 |
|                  |     |branch|`nUp([...nR, v1, ...n2])`           |1+1+3...5+1+5        |5...11|
|                  |    2|leaf  |`vUp([...n0, v1, ...vR])`           |                     |2...5 |
|                  |     |branch|`nUp([...n0, v1, ...nR])`           |                     |5...11|
|`[n0,v1,n2,v3,n4]`|    0|leaf  |`vUp([...vR, v1, ...n2, v3, ...n4])`|0+1+1+1+1...2+1+2+1+2|4...8 |
|                  |     |branch|`nUp([...nR, v1, ...n2, v3, ...n4])`|1+1+3+1+3...5+1+5+1+5|9...17|
|                  |    2|leaf  |`vUp([...n0, v1, ...nR, v3, ...n4])`|                     |      |
|                  |     |branch|`nUp([...n0, v1, ...nR, v3, ...n4])`|                     |      |
|                  |    4|leaf  |`vUp([...n0, v1, ...n2, v3, ...nR])`|                     |      |
|                  |     |branch|`nUp([...n0, v1, ...n2, v3, ...nR])`|                     |      |

## Insert

`insert` returns `Branch1` or `Branch3`

|type              |                                 |
|------------------|---------------------------------|
|`[v]`             |`[[vI,v]]`                       |
|                  |`[[v,vI]]`                       |
|`[v0,v1]`         |`[[vI],v0,[v1]]`                 |
|                  |`[[v0],vI,[v1]]`                 |
|                  |`[[v0],v1,[vI]]`                 |
|`[n0,v1,n2]`      |`up([...insert(n0),v1,n2])`      |
|                  |`up([n0,v1,...insert(n2)])`      |
|`[n0,v1,n2,v3,n4]`|`up([...insert(n0),v1,n2,v3,n4])`|
|                  |`up([n0,v1,...insert(n2),v3,n4])`|
|                  |`up([n0,v1,n2,v3,...insert(n4)])`|
