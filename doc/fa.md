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