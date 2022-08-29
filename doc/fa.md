# FA

F ::= A 'hello'
F ::= A 'help'

## Classic FA

S0 ::= A 'h'
S1 ::= S0 'e'
S2 ::= S1 'l'
S3 ::= S2 'l'
F ::= S3 'o'

X0 ::= A 'h'
X1 ::= X0 'e'
X2 ::= X1 'l'
F ::= X2 'p'

## DFA

{S0,X0} = A 'h'
{S1,X1} ::= {S0,X0} 'e'
{S2,X2} ::= {S1,X1} 'l'
S3 ::= {S2,X2} 'l'
F ::= {S2,X2} 'p'
F ::= S3 'o'

P0 = A 'h'
P1 ::= P0 'e'
P2 ::= P1 'l'
S3 ::= P2 'l'
F ::= P2 'p'
F ::= S3 'o'

## Tokenizer FA

T ::= I 'true'  // T0, T1, T2
F ::= I 'false' // F0, F2, F2, F3
N ::= I 'null'  // N0, N1, N2
Id ::= I letter
Id ::= Id letter
Id ::= Id digit

## Tokenizer DFA

{T0,Id} = I 't'
{T1,Id} = {T0,Id} 'r'
Id = {T0,Id} letter(except 'r')
Id = {T0,Id} digit

{a..b}{c..d}{e..f}

```js
const t0 = [[init, one('t')]]
const t1 = [[t0, one('r')]]
const t2 = [[t1, one('u')]]
const t = [[t2, one('e')]]

const id = [
    [init, letter]
    [() => id, letter]
    [() => id, digit]
]

const dfa = ([t, f, n, id]) => ?
```

## Set

```js
const letter = byteSet(['_', '$', ['a', 'z'], ['A', 'Z']])
```

Letters and digits

|      |            |
|------|------------|
|`$`   |`0x24`      |
|`0..9`|`0x30..0x39`|
|`A..Z`|`0x41..0x5A`|
|`_`   |`0x5F`      |
|`a..z`|`0x61..0x7A`|

## Bit set

For a byte, it is an array of 8 uint32, bigint (0..2^256-1), or string of 16 characters.

### 16 bit set.

It can use an intermediate state.

|   |       |        |
|---|-------|--------|
|`2`|`4`    |`$`     |
|`3`|`..9`  |`0..9`  |
|`4`|`1..`  |`A..O`  |
|`5`|`..A,F`|`P..Z,_`|
|`6`|`1..`  |`a..o`  |
|`7`|`..A`  |`p..z`  |

```js
const init = [
   _,  _, i2,  _,
  i4, i5, i4, i7,
   _,  _,  _,  _,
   _,  _,  _,  _]

const i2 = [
   _,  _,  _,  _,
  id,  _,  _,  _,
   _,  _,  _,  _,
   _,  _,  _,  _]

const i3 = [
  id, id, id, id,
  id, id, id, id,
  id, id,  _,  _,
   _,  _,  _,  _]

const i4 = [
   _, id, id, id,
  id, id, id, id,
  id, id, id, id,
  id, id, id, id]

const i5 = [
  id, id, id, id,
  id, id, id, id,
  id, id, id,  _,
   _,  _,  _, id]

const i6 = [
  id, id, id, id,
  id, id, id, id,
  id, id, id,  _,
   _,  _,  _,  _]
```

```js
const init =
  000_000_001_000
  010_011_100_101
  000_000_000_000
  000_000_000_000

const i = [
  // 1
  0000_1000_0000_0000,
  // 2
  1111_1111_1100_0000,
  // 3
  0111_1111_1111_1111,
  // 4
  1111_1111_1110_0001,
  // 5
  1111_1111_1110_0000,
]
```