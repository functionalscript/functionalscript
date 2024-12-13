# FunctionalScript Language

Two main FunctionsScript principles:

1. if FS code pass validation/compilation, then it doesn't have side-effects,
2. the code that passed validation/compilation should behave on FunctionalScript VM the same way as on any other modern JavaScript engine.

When we implement features of FunctionalScript, the first priority is a simplification of the VM.

File Types:

|File Type|Extension        |Notes       |
|---------|-----------------|------------|
|JSON     |`.json`          |Not a graph.|
|DJS      |`.d.js`, `.d.mjs`|A graph.    |
|FJS      |`.f.js`, `.f.mjs`|Functions.  |

**Note**: An FJS value can't be serialized without additional run-time infrastructure.

## 1. JSON

- [ ] [JSON](./1000-json.md).

**VM**:

We are introducing new commands in the order that every new command depends only on previous commands.

|format|any           |Tag|          |
|------|--------------|---|----------|
|JSON  |null          | 00|          |
|      |number        | 01|u64       |
|      |false         | 02|          |
|      |true          | 03|          |
|      |string        | 04|String    |
|      |array         | 05|Array<Any>|
|      |object        | 06|Object    |

## 2. DJS

The DJS form a graph of values. It can be serialized without additional run-time information.

File extensions: `.d.js` and `.d.mjs`.

|format|any                     |Tag|          |Notes                                           |
|------|------------------------|---|----------|------------------------------------------------|
|DJS   |const_ref               | 07|u32       |[const](./2120-const.md)                        |
|      |bigint_plus             | 08|Array<u64>|[bigint](./2320-bigint.md)                      |
|      |bigint_minus            | 09|Array<u64>|[bigint](./2320-bigint.md)                      |
|      |undefined               | 0A|          |[undefined](./2310-undefined.md)                |
|      |own_property            | 0B|          |[property-accessor](./2330-property-accessor.md)|
|      |instance_property       | 0C|          |[property-accessor](./2330-property-accessor.md)|
|      |instance_method_call    | 0D|          |[property-accessor](./2330-property-accessor.md)|
|      |at                      | 0E|          |[property-accessor](./2330-property-accessor.md)|
|      |operators               |   |          |[operators](./2340-operators.md)                |

### 2.1. Required

1. [ ] [default-export](./2110-default-export.md),
2. [ ] [const](./2120-const.md),
3. [ ] [default-import](./2130-default-import.md).

### 2.2. Priority 1

We need it to use JSDoc and TypeScript.

1. [ ] [block-comment](./2210-block-comment.md),
2. [ ] [namespace-import](./2220-namespace-import.md).

### 2.3. Priority 2

1. [ ] [undefined](./2310-undefined.md),
2. [ ] [bigint](./2320-bigint.md),
3. [ ] [property-accessor](./2330-property-accessor.md),
4. [ ] [operators](./2340-operators.md),
5. [ ] [grouping](./2350-grouping.md),
6. [ ] [built-in](./2360-built-in.md).

### 2.4. Syntactic Sugar

1. [ ] [identifier-property](./2410-identifier-property.md),
2. [ ] [line-comment](./2420-line-comment.md),
3. [ ] [trailing-comma](./2430-trailing-comma.md),
4. [ ] [shorthand](./2440-shorthand.md),
5. [ ] [destructuring](./2450-destructuring.md).

## 3. FJS

The FJS can have functions. The format requires additional run-time information for serialization.

File extensions: `.f.js` and `.f.mjs`.

|format|any     |Tag|    |Notes                           |
|------|--------|---|----|--------------------------------|
|FJS   |function|   |Func|[function](./3110-function.md)  |

### 3.1. Required

1. [ ] [function](./3110-function.md)
2. [ ] [parameters](./3120-parameters.md)
3. [ ] [body-const](./3130-body-const.md)

### 3.2. Priority 1

1. [ ] `if`. See https://developer.mozilla.org/en-US/docs/Glossary/Falsy
2. [ ] [let](./3220-let.md)
3. [ ] `while`
4. [ ] [export](./3240-export.md)
5. [ ] Regular Expressions
6. [ ] Ownership of Mutable Objects (Singletons)
7. [ ] [type inference](./3270-type-inference.md)
8. [ ] [async/await](./3280-async.md)
9. [ ] [class](./3290-class.md)

### 3.3. Syntactic Sugar

1. [ ] [expression](./3210-expression.md)
2. [ ] [one-parameter](./3220-one-parameter.md)
3. [ ] [assignments](./3330-assignments.md)

## 4. ECMAScript Proposals

1. [ ] [Type Annotations](https://github.com/tc39/proposal-type-annotations), Stage 1:
   - [Node.js](https://nodejs.org/en/learn/typescript/run-natively),
   - `Deno` supports TypeScript,
   - `Bun` supports TypeScript,
   - most browsers don't support the feature.
2. [ ] [Pipe Operator `|>`](https://github.com/tc39/proposal-pipeline-operator), Stage 2.
3. [ ] [Records and Tuples](https://github.com/tc39/proposal-record-tuple), Stage 2.

## 5. I/O

### 5.1. Isolated I/O

Using dependency injection.

This implementation of VM requires external function implementation.

### 5.2 Isolated Asynchronous I/O

It requires a promise implementation at least on a parser level.

### 5.3. State Machine with Asynchronous Requests

VM doesn't need to implement external functions or promises.

```ts
type RequestType = ...;
type Request = readonly[Input, Continuation];
type Continuation = (_: Output) => Request;
type Main = Request
```
