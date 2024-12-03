# FunctionalScript Language

When we implement features of FunctionalScript, the first priority is simplification of VM.

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
|      |bigint+                 | 08|Array<u64>|[bigint](./2320-bigint.md)                      |
|      |bigint-                 | 09|Array<u64>|[bigint](./2320-bigint.md)                      |
|      |undefined               | 0A|          |[undefined](./2310-undefined.md)                |
|      |operators               |   |          |[operators](./2340-operators.md)                |
|      |property-accessors `a.b`|   |          |[property-accessor](./2351-property-accessor.md)|
|      |property-call `a.b(c)`  |   |          |[property-call](./2352-property-call.md)        |
|      |at `a[b]`               |   |          |[at](./2353-at.md)                              |
|      |built-in functions      |   |          |[built-in](./2360-built-in.md)                  |

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
3. [ ] [grouping](./2330-grouping.md),
4. [ ] [operators](./2340-operators.md),
5. [ ] Property Accessors:
   1. [ ] [property-accessor](./2351-property-accessor.md),
   2. [ ] [property-call](./2352-property-call.md),
   3. [ ] [at](./2353-at.md),
6. [ ] [built-in](./2360-built-in.md).

### 2.4. Syntax Sugar

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

1. [ ] `if`
2. [ ] [let](./3220-let.md)
3. [ ] `while`

### 3.3. Syntax Sugar

1. [ ] [expression](./3210-expression.md)
2. [ ] [one-parameter](./3220-one-parameter.md)
3. [ ] [assignments](./3330-assignments.md)
