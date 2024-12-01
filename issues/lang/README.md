# FunctionalScript Language

## File Types

|File Type|Extension        |Notes       |
|---------|-----------------|------------|
|JSON     |`.json`          |Not a graph.|
|DJS      |`.d.js`, `.d.mjs`|A graph.    |
|FJS      |`.f.js`, `.f.mjs`|Functions.  |

**Note**: An FJS value can't be serialized without additional run-time infrastructure.

## 1. JSON

- [ ] [JSON](./1000-json.md).

## 2. DJS

The DJS form a graph of values. It can be serialized without additional run-time information.

File extensions: `.d.js` and `.d.mjs`.

### 2.1. Required

1. [ ] [default-export](./211-default-export.md)
2. [ ] [const](./212-const.md)
3. [ ] [default-import](./213-default-import.md)

### 2.2. Priority 1

We need it to use JSDoc and TypeScript.

1. [ ] [block-comment](./221-block-comment.md)
2. [ ] [namespace-import](./222-namespace-import.md)

### 2.3. Priority 2

1. [ ] [undefined](./231-undefined.md)
2. [ ] [bigint](./232-bigint.md)
3. [ ] [grouping](./233-grouping.md)
4. [ ] [operators](./234-operatos.md)
5. [ ] [property-accessor](./235-property-accessor.md)
6. [ ] [property-call](./236-property-call.md)
7. [ ] [at](./237-at.md)
8. [ ] [global]

### 2.4. Syntax Sugar

1. [ ] [identifier-property](./241-identifier-property.md)
2. [ ] [line-comment](./242-line-comment.md)
3. [ ] [trailing-comma](./243-trailing-comma.md)
4. [ ] [shorthand](./244-shorthand.md)
5. [ ] [destructuring](./245-destructuring.md)

## 3. FJS

The FJS can have functions. The format requires additional run-time information for serialization.

File extensions: `.f.js` and `.f.mjs`.

### 3.1. Required

1. [ ] [function](./311-function.md)
2. [ ] [parameters](./312-parameters.md)
3. [ ] [body-const](./313-body-const.md)

### 3.2. Syntax Sugar

1. [ ] [expression](./321-expression.md)
2. [ ] [one-parameter](./322-one-parameter.md)
