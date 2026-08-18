# VM Command Format

A design document for the command format of the FunctionalScript VM.

We are introducing new commands in such a way that every new command depends
only on previous commands.

## JSON commands

|format|any           |          |
|------|--------------|----------|
|JSON  |undefined     |          |
|      |null          |          |
|      |false         |          |
|      |true          |          |
|      |number        |u64       |
|      |string        |String    |
|      |array         |Array<Any>|
|      |object        |Object    |

## DJS commands

|format|any                     |          |Notes                                           |
|------|------------------------|----------|------------------------------------------------|
|DJS   |const_ref               |u32       |[const](../README.md#shared-values-constants)                       |
|      |bigint_plus             |Array<u64>|[bigint](../README.md#supported-value-types)                     |
|      |bigint_minus            |Array<u64>|[bigint](../README.md#supported-value-types)                     |
|      |undefined               |          |[undefined](../README.md#supported-value-types)               |
|      |own_property            |          |[property-accessor](./2330-property-accessor.md)|
|      |instance_property       |          |[property-accessor](./2330-property-accessor.md)|
|      |instance_method_call    |          |[property-accessor](./2330-property-accessor.md)|
|      |at                      |          |[property-accessor](./2330-property-accessor.md)|
|      |operators               |          |[operators](./2340-operators.md)                |

## FJS commands

|format|any     |    |Notes                          |
|------|--------|----|-------------------------------|
|FJS   |function|Func|[function](./3110-function.md) |

## NPN (Normal Polish Notation)

We will use [NPN](https://en.wikipedia.org/wiki/Polish_notation) as a command format for our VM because it allows us to allocate required objects during streaming as a stack automata.


```js
{2} "a" null "b" [3] -42.5 false "hello"

// evolution
<> {2} "a" null "b" [3] -42.5 false "hello"
{ ?: ?, ?: ? } <{4}> "a" null "b" [3] -42.5 false "hello"
{ "a": ?, ?: ? } <{3}> null "b" [3] -42.5 false "hello"
{ "a": null, ?: ? } <{2}> "b" [3] -42.5 false "hello"
{ "a": null, "b": ? } <{1}> [3] -42.5 false "hello"
{ "a": null, "b": [?, ?, ?] } <{0}[3]> -42.5 false "hello"
{ "a": null, "b": [-42.5, ?, ?] } <{0}[2]> false "hello"
{ "a": null, "b": [-42.5, false, ?] } <{0}[1]> "hello"
{ "a": null, "b": [-42.5, false, "hello"] } <>
```

## RPN, just for fun

[Reverse Polish Notation](https://en.wikipedia.org/wiki/Reverse_Polish_notation):

```js
"a" null "b" -42.5 false "hello" [3] {2}

// evolution:
"a" <> null "b" -42.5 false "hello" [3] {2}
"a" null <> "b" -42.5 false "hello" [3] {2}
"a" null "b" <> -42.5 false "hello" [3] {2}
"a" null "b" -42.5 <> false "hello" [3] {2}
"a" null "b" -42.5 false <> "hello" [3] {2}
"a" null "b" -42.5 false "hello" <> [3] {2}
"a" null "b" [-42.5, false, "hello"] <> {2}
{ "a" : null, "b": [-42.5, false, "hello"] } <>
```
