# FunctionalFcript

FunctionalScript is a pure functional programming language as a subset of [ECMAScript](https://en.wikipedia.org/wiki/ECMAScript)/[JavaScript](https://en.wikipedia.org/wiki/JavaScript). It's inspired by 

- [JSON](https://en.wikipedia.org/wiki/JSON), as a subset of JavaScript;
- [asm.JS](https://en.wikipedia.org/wiki/Asm.js)/[WebAssembly](https://en.wikipedia.org/wiki/WebAssembly), as a subset of JavaScript;
- [TypeScript](https://en.wikipedia.org/wiki/TypeScript), as a superset of JavaScript.

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

Hex, binary and octal literals
Functions with multiple parameters.
Spread syntax. For example `...object`.
Destructing assignments. For example `const {a,b} = exp;`, `const [a, b] = exp`.
Property Id expression `{ [exp]: exp }`.
Allow no semicolons.
Optional comma in arrays and objects.
Template literals ``const r= `onst r = ${exp}`;``.
Multiline strings 
```js
'sss\
   wwww'
```
Regular expressions.

## Stage 1

Typing using JSDoc and TypeScript types.

## Stage 2

Mutable types with exclusive ownership (similar to Rust mutability).

- `let`, `for`, `while` etc.
- Generators `function*(){  ... yield ... }`.
- Async `async () => f(await exp())`.

Controversial ideas: 

- Import and export `import x from "..."`, `export const x = ...`, `export default = ` e.t.c. This may break `new Function` runners. 
- Functional-TypeScript as a subset of TypeScript. Note: FunctionalScript doesn't require an additional build step in contrast to TypeScript.
