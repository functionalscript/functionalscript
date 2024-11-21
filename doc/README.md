# Documentation

FunctionalScript files have `.f.cjs` file extensions because it's using a `Common.JS` module system. We plan to add 
ESM support when we have the first parser working. See
[ESM. Resolver Algorithm Specification](https://nodejs.org/api/esm.html#resolver-algorithm-specification)
and [ESM. Enabling](https://nodejs.org/docs/latest-v13.x/api/esm.html#esm_enabling).

## 1. Creating a New Repository

Creating from a template https://github.com/functionalscript/template/generate

## 1.1. Creating From Scratch

Prerequisites:

- [Git](https://git-scm.com/).
- [Node.js](https://nodejs.org/en/).
- GitHub account.

Creating a new GitHub repository

1. Create a public git repository on GitHub using Node template.
2. Clone the repository.
3. Go to the root directory of the cloned repository.
4. Run `npm init`. It should create `package.json` file.
5. Create a `main.f.cjs` file in the repository root directory.
6. Edit the `main.f.cjs` file. For example
    ```js
    module.exports = "Hello world!"
    ```
11. Go to [functionalscript.com](https://functionalscript.com) and enter `github:YOUR_GITHUB_NAME/YOUR_REPOSITORY_NAME`. Press `Build`.

### 1.1. Optional

1. Install [Visual Studio Code](https://code.visualstudio.com/).
2. Add [TypeScript](https://www.typescriptlang.org/) to your repository for static type checking.
   1. Run `npm install -D typescript`.
   2. Run `npx tsc --init`. It should create `tsconfig.json` file.
   3. Uncomment `"allowJs": true,` and `"checkJs": true` in the `tsconfig.json` file.

## 2. Language

### 2.1. Exports

```js
module.exports = 'Hello world!'
```

```js
module.exports = { a: 'hello', b: 42 }
```

```js
module.exports = x => x * x
```

### 2.2. Reference Another Module

#### 2.2.1. Local File

```js
const x = require('./folder/main.f.cjs')
```

### 2.2.2. External Module

Run `npm install -D github:USER/REPO`

```js
const x = require(`REPO/DIR/FILE.f.cjs`)
```

### 2.3. Functions

```js
const f = x => x * x
const fResult = f(42)

const plus = a => b => a + b
const plusResult = plus(a)(b)

const sum = ar => ar.reduce((a, i) => a + i, 0)
const sumResult = sum([1, 2, 3])
```

## 3. Advanced

### 3.1. Generators

```js
const range5 = {*[System.iterator]() {
    yield 0
    yield 1
    yield 2
    yield 3
}}
```
