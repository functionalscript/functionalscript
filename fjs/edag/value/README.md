# EDAG values

What an EDAG evaluates to, and every operation on it. A value is data or a
function: data is a primitive, or an array or object node whose items are
values; a function keeps its evaluated captures and its body as an
unevaluated EDAG expression. [`module.f.mjs`](./module.f.mjs) holds the shape
schemas, [`types.ts`](./types.ts) the `EdagValue` type, and the directories
below hold the operations both interpreters, [`memo`](../memo/README.md) and
[`amnesia`](../amnesia/README.md), share.

The contracts these modules keep (identity, failure, runtime compilation) are
written once in [`../values.md`](../values.md), and the root
[`README.md`](../README.md) walks through the larger ones.

## Three rules every module here keeps

- **Identity is kept.** An array, object or function value is a node, and two
  values are the same value only when they are the same node. A constructor
  makes a fresh node; every other operation passes nodes through.
- **Failure is a value.** An operation answers `Result<EdagValue, EdagValue>`.
  Its own failure, such as calling a non-function, is
  `error(['undefined'])`; a failure it receives from an operand or a callback
  passes through unchanged.
- **Undefined is tagged.** `undefined` is the value `['undefined']`, so an
  absent value and a missing one are never confused with JavaScript's own
  `undefined`.

## The modules

|Module                                     |Holds                                                                         |
|-------------------------------------------|------------------------------------------------------------------------------|
|**Constructing**                           |                                                                              |
|[`array`](./array/module.f.mjs)            |arrays from deferred items and spreads, and joining them as strings          |
|[`object`](./object/module.f.mjs)          |objects from deferred properties and spreads, keys in enumeration order      |
|[`function`](./function/module.f.mjs)      |functions from deferred captures and a body                                  |
|**Reading**                                |                                                                              |
|[`property`](./property/module.f.mjs)      |property lookup: object fields, array items and `length`, string code units  |
|[`at`](./at/module.f.mjs)                  |`at` on arrays and strings, counting negative indices from the end           |
|[`slice`](./slice/module.f.mjs)            |`slice` on arrays and strings                                                |
|[`entries`](./entries/module.f.mjs)        |`Object.entries`, the one static no body can define                          |
|**Operating**                              |                                                                              |
|[`semantics`](./semantics/module.f.mjs)    |truthiness, `typeof`, and strict equality by node identity                   |
|[`numeric`](./numeric/module.f.mjs)        |unary `+`, `-`, `~` and `Number(x)`                                          |
|[`relational`](./relational/module.f.mjs)  |`<`, `<=`, `>`, `>=`                                                         |
|[`coercion`](./coercion/module.f.mjs), [`convert`](./convert/module.f.mjs)|objects to primitives, primitives to strings and numbers|
|[`control`](./control/module.f.mjs)        |`throw`, `?:` and sequencing, demanding only the operands they select        |
|**Calling**                                |                                                                              |
|[`call`](./call/module.f.mjs)              |calls of represented functions, arguments resolved left to right             |
|[`method`](./method/module.f.mjs)          |built-in method calls, resolved through the runtime the executor was given   |
|[`array_method`](./array_method/module.f.mjs)|`map`, `filter`, `sort` and the other pure array methods                   |
|**Checking and leaving**                   |                                                                              |
|[`metadata`](./metadata/module.f.mjs)      |unique, ordered object keys in data supplied from outside                   |
|[`closure`](./closure/module.f.mjs)        |closure bindings, body scopes and function lengths in supplied data          |
|[`to_unknown`](./to_unknown/module.f.mjs)  |`toData`: values as ordinary JavaScript values, sharing kept; `toUnknown` compiles functions|

The checks in `metadata` and `closure` are for EDAG that arrives as data, at an
explicit boundary. A VM that builds values with the constructors above keeps
the invariants by construction and does not check every result again.
