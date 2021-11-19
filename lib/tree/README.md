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

- { found: `true`, value: `T`,  } |
  { found: `false` }
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
  - get: { found: `true` ... }
  - replace: { replace: ... }
- notFound:
  - none: { found: `false` }
  - insert: { replace: ... } | { overflow: ... }

|               |found.get  |found.replace  |
|---------------|-----------|---------------|
|notFound.none  |get        |replace        |
|notFound.insert|getOrInsert|replaceOrInsert|

## Branch3 Overflow

- current `[n0 v0 n1]`
- overflow `[L VM R]`

|type  |index|{ replace: Branch5 }|
|------|-----|--------------------|
|left  |    0|`[(L VM R) v0 n1]`  |
|right |    2|`[n0 v0 (L VM R)]`  |

## Branch5 Overflow 

- current `[n0, v0, n1, v1, n2]`
- overflow `[L, VM, R]`

|type  |index|Operation           |Branch7                 |{ overflow: Branch3 }       |
|------|-----|--------------------|------------------------|----------------------------|
|left  |    0|`[...o v0 n1 v1 n2]`|`[(L VM R) v0 n1 v1 n2]`|`[[ L VM R ] v0 [n1 v1 v2]]`|
|middle|    2|`[n0 v0 ...o v1 n2]`|`[n0 v0 (L VM R) v1 n2]`|`[[n0 v0 L ] VM [ R v1 n2]]`|
|right |    4|`[n0 v0 n1 v1 ...o]`|`[n0 v0 n1 v1 (L VM R)]`|`[[n0 v0 n1] v1 [ L VM R ]]`|
