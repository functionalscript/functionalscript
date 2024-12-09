# Documentation

FunctionalScript files have `.f.mjs` file extensions because it's using a ES module system.

## 1. Language

### 1.1. Exports

```js
export default 'Hello world!'
```

```js
export default { a: 'hello', b: 42 }
```

```js
export default x => x * x
```

### 1.2. Reference Another Module

#### 1.2.1. Local File

```js
import x from './folder/main.f.mjs'
```

### 1.2.2. External Module

Run `npm install -D github:USER/REPO`

```js
import x from `REPO/DIR/FILE.f.mjs`
```

### 1.3. Functions

```js
const f = x => x * x
const fResult = f(42)

const plus = a => b => a + b
const plusResult = plus(a)(b)

const sum = ar => ar.reduce((a, i) => a + i, 0)
const sumResult = sum([1, 2, 3])
```

## 2. Advanced

### 2.1. Generators

```js
const range5 = {*[System.iterator]() {
    yield 0
    yield 1
    yield 2
    yield 3
}}
```
