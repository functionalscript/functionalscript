# FunctionalFcript

FunctionalScript is a pure functional programming language as a subset of JavaScript. It's inspired by 

- JSON, as a subset of JavaScript;
- Asm.JS (WebAssembly), as a subset of JavaScript;
- TypeScript, as a superset of JavaScript.

## JSON

```js
jsonFile = expression
expression = primitive | array | objects
primitive = 'true' | 'false' | 'null' | number | string
array = '[' (() | items) ']'
items = expression (() | ',' items)
object = '{' (() | properties) '}'
properties = propertyId ':' expression (() | ',' properties)
propertyId = string
```

## Stage 0

```js
fjsFile = expression
expression = primitive | array | object | func | id | propertyAccessor
func = ('()' | id) '=>' '{' statements 'return' expression ';' '}'
statements = () | (statement statements)
statement = `const` id `=` expression `;`
propertyAccessor = expression `[` expression `]`
call = expression `(` ( expression | ()) `)`
```

### Stage 0.1. Node.js

```js
nodeFile = statements 'module.exports' '=' expression ';'
```

### Stage 0.2. 

#### Operators

```js
expression = ... | 'undefined' | groupingOperator | binaryOperatorExpression | unaryOperator | conditionalOperator
groupingOperator = '(' expression ')'
binaryOperatorExpression = expression binaryOperator expression
binaryOperator = comparisonOperator | arithmeticOperator | bitwiseOperator | logicalOperators | '??'
comparisonBinaryOperator = '===' | '!==' | '>' | '<' | '>=' | '<='
arithmeticBinaryOperator = '+' | '-' | '*' | '/' | '%' | '**'
bitwiseBinaryOperator = '&' | '|' | '^' | '<<' | '>>' | '>>>'
logicalBinaryOperator = '&&' | '||'
unaryOperator = '-' | '~' | '!'
conditionalOperator = expression '?' expression ':' expression
```

No `==`, `!=`, `=...` operators.

#### Function Expression

```js
func = ('()' | id) '=>' (('{' statements 'return' expression ';' '}') | expression)
```

#### PropertyAccessor

```js
propertyAccessor = expression (('[' expression ']') | ('.' id))
```

```js
propertyId = string | id
```

#### BigInt

For example `42n`.

#### Additional Operators

```js
typeOfOperator = 'typeof' expression
inOperator = expression 'in' expression
```

### Stage 0.3. Syntax sugar

Functions with multiple parameters.
Spread syntax. For example `...object`.
Destructing assignments. For example `const {a,b} = exp;`, `const [a, b] = exp`.
Property Id expression `{ [exp]: exp }`.
Allow no semicolons.
Optional comma in arrays and objects.

## Stage 1

Typing using JSDoc and TypeScript types.

## Stage 2

Mutable types with exclusive ownership (similar to Rust mutability).
`let`, `for`, `while` etc.
Import and export `import x from "..."`, `export const x = ...`, `export default = ` e.t.c. Note: this may break `new Function` runners. 

Generators `function*(){  ... yield ... }`. ?
Async `async () => f(await exp())`. ?
Exports object `exports.x = exp` ?
