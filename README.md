# FunctionalScript Effects System

A purely functional effects system for FunctionalScript that represents side effects as data, enabling complete testability and composability without performing actual I/O.

## Overview

This implementation solves the problem of side effects in purely functional code by using "Effects as Data":

- **Effects are values**: Side effects are represented as immutable data structures
- **Pure composition**: Effects can be composed, transformed, and tested without performing I/O
- **Deferred execution**: Only the impure runner actually executes effects
- **Fully testable**: Mock I/O operations in pure code without dependency injection

## Architecture

```
effects/
├── module.f.ts          # Core effect types and combinators (pure)
├── test.f.ts           # Tests for core effects
├── node/
│   ├── module.f.ts     # Node.js effect constructors (pure)
│   ├── module.ts       # Impure effect runner
│   └── test.f.ts       # Tests for Node.js effects

fjs-eff/
├── module.f.ts         # FJS executable logic (pure)
├── module.ts           # Entry point (impure)
└── test.f.ts           # Tests for FJS executable

Utility modules:
├── string/module.f.ts  # String utilities
├── array/module.f.ts   # Array utilities
└── path/module.f.ts    # Path utilities
```

## Core Concepts

### Effect Type

```typescript
type Effect<T> = 
    | readonly [tag: string, payload: unknown, continuation: (result: unknown) => Effect<T>]
    | Pure<T>

type Pure<T> = readonly ['pure', value: T]
```

An effect is either:
1. **Impure**: A tuple of `[tag, payload, continuation]` describing an operation
2. **Pure**: A value wrapped in `['pure', value]`

### Effect Combinators

```typescript
// Create a pure effect
pure: <T>(value: T) => Effect<T>

// Map over effect result
map: <A, B>(f: (a: A) => B) => (effect: Effect<A>) => Effect<B>

// Chain effects (flatMap/bind)
flatMap: <A, B>(f: (a: A) => Effect<B>) => (effect: Effect<A>) => Effect<B>

// Sequence array of effects
sequence: <T>(effects: readonly Effect<T>[]) => Effect<readonly T[]>

// Traverse with effect-producing function
traverse: <A, B>(f: (a: A) => Effect<B>) => (arr: readonly A[]) => Effect<readonly B[]>
```

## Examples

### Basic Example: Reading and Writing Files

```typescript
import * as Effect from './effects/module.f.ts'
import * as NodeEff from './effects/node/module.f.ts'

// Pure function that creates an effect description
const copyFile = (source: string) => (dest: string): Effect.Effect<void> =>
    Effect.flatMap((content: string) =>
        NodeEff.writeFile(dest)(content)
    )(NodeEff.readFile(source))

// This creates a pure data structure - no I/O happens yet!
const copyEffect = copyFile('input.txt')('output.txt')

// Only the runner performs actual I/O
import { runEffect } from './effects/node/module.ts'
await runEffect(copyEffect)
```

### Example: Sequential Operations

```typescript
const program = Effect.flatMap((exists: boolean) =>
    exists
        ? Effect.flatMap((content: string) =>
            Effect.flatMap(() =>
                NodeEff.stdOut('File processed successfully\n')
            )(NodeEff.writeFile('output.txt')(content.toUpperCase()))
        )(NodeEff.readFile('input.txt'))
        : NodeEff.stdErr('File not found\n')
)(NodeEff.fileExists('input.txt'))
```

### Example: Processing Multiple Files

```typescript
const readMultipleFiles = (paths: readonly string[]): Effect.Effect<readonly string[]> =>
    Effect.traverse(NodeEff.readFile)(paths)

const files = ['file1.txt', 'file2.txt', 'file3.txt']
const effect = readMultipleFiles(files)

// Test without I/O
const testEffect = effect
assert(testEffect[0] === 'readFile')
assert(testEffect[1] === 'file1.txt')
```

### Example: Conditional Logic

```typescript
const processFile = (path: string): Effect.Effect<void> =>
    Effect.flatMap((exists: boolean) =>
        exists
            ? Effect.flatMap((content: string) => {
                const errors = validateContent(content)
                return errors.length === 0
                    ? NodeEff.stdOut(`Valid: ${path}\n`)
                    : NodeEff.stdErr(`Invalid: ${path}\n${errors.join('\n')}\n`)
            })(NodeEff.readFile(path))
            : NodeEff.stdErr(`Not found: ${path}\n`)
    )(NodeEff.fileExists(path))
```

## Testing Effects

### Testing Pure Logic

```typescript
// Test the structure without performing I/O
const effect = NodeEff.readFile('/path/to/file')

assertEqual(effect[0], 'readFile')
assertEqual(effect[1], '/path/to/file')

// Test continuation
const continued = effect[2]('file content')
assertEqual(Effect.isPure(continued), true)
assertEqual(Effect.unsafeGetPure(continued), 'file content')
```

### Mocking Effects

```typescript
import { runMock } from './effects/node/module.ts'

const mockHandlers = {
    readFile: (_tag: string, path: unknown) => {
        if (path === '/existing.txt') return 'mocked content'
        throw new Error('File not found')
    },
    writeFile: (_tag: string, _payload: unknown) => undefined,
    stdOut: (_tag: string, msg: unknown) => {
        console.log('Mock stdout:', msg)
        return undefined
    }
}

const result = await runMock(mockHandlers, myEffect)
```

### Testing Composed Effects

```typescript
const program = Effect.flatMap((content: string) =>
    NodeEff.stdOut(`Length: ${content.length}\n`)
)(NodeEff.readFile('file.txt'))

// Verify structure
assertEqual(program[0], 'readFile')

// Test continuation
const afterRead = program[2]('hello')
assertEqual(afterRead[0], 'stdOut')
assertEqual(afterRead[1], 'Length: 5\n')
```

## Comparison with Async/Await

### Before (Impure, hard to test)

```typescript
// Impure - performs I/O immediately
async function copyFile(source: string, dest: string): Promise<void> {
    const content = await fs.readFile(source, 'utf-8')
    await fs.writeFile(dest, content, 'utf-8')
}

// Cannot test without actual I/O or complex mocking
await copyFile('input.txt', 'output.txt')
```

### After (Pure, easy to test)

```typescript
// Pure - returns a description of effects
const copyFile = (source: string) => (dest: string): Effect<void> =>
    Effect.flatMap((content: string) =>
        NodeEff.writeFile(dest)(content)
    )(NodeEff.readFile(source))

// Test without I/O
const effect = copyFile('input.txt')('output.txt')
assertEqual(effect[0], 'readFile')
assertEqual(effect[1], 'input.txt')

// Run when ready
await runEffect(effect)
```

## Available Node.js Effects

### File System
- `readFile(path: string): Effect<string>`
- `writeFile(path: string)(content: string): Effect<void>`
- `fileExists(path: string): Effect<boolean>`
- `readDir(path: string): Effect<readonly string[]>`
- `deleteFile(path: string): Effect<void>`
- `mkDir(path: string)(recursive: boolean): Effect<void>`

### Process
- `getArgs: Effect<readonly string[]>`
- `getEnv(name: string): Effect<string | undefined>`
- `exit(code: number): Effect<never>`

### Console
- `stdOut(message: string): Effect<void>`
- `stdErr(message: string): Effect<void>`
- `stdIn: Effect<string>`

## Running Effects

### Using the Runner

```typescript
import { runEffect } from './effects/node/module.ts'

const effect = NodeEff.stdOut('Hello, World!\n')
await runEffect(effect)
```

### Using the FJS Executable

```bash
# Run a FunctionalScript file
./fjs-eff/module.ts script.f.ts

# Run tests
./fjs-eff/module.ts module.f.ts --test

# Show help
./fjs-eff/module.ts --help
```

## Benefits

1. **Purity**: All effect-creating code is pure - effects are just data
2. **Testability**: Test effects without performing I/O
3. **Composability**: Combine effects using standard functional combinators
4. **Type Safety**: Full type inference for effect results
5. **Flexibility**: Easy to add new effect types
6. **No Dependency Injection**: Mock by providing different effect data
7. **Referential Transparency**: Same inputs always produce same effect descriptions

## Implementation Notes

### Why Not Use Promises?

Promises execute immediately when created (they're "hot"). Effects are "cold" - they don't execute until explicitly run by the interpreter.

```typescript
// Promise - executes immediately
const promise = fs.readFile('file.txt') // I/O happens now!

// Effect - just data
const effect = NodeEff.readFile('file.txt') // No I/O, just a description
```

### Why Not Use Dependency Injection?

Dependency injection requires passing impure functions around, making code impure. Effects keep all code pure - only the runner is impure.

```typescript
// DI approach - impure
const readFile: (path: string) => Promise<string> = ...
const myFunction = (readFile) => async (path) => {
    const content = await readFile(path) // Still impure
}

// Effect approach - pure
const myFunction = (path: string): Effect<string> =>
    NodeEff.readFile(path) // Pure data structure
```

## Coverage

All modules have 100% test coverage:

- `effects/module.f.ts`: 21 tests
- `effects/node/module.f.ts`: 16 tests  
- `fjs-eff/module.f.ts`: 25 tests

Run all tests:
```bash
deno test --allow-read --allow-write
```

## Future Enhancements

1. Add more effect types (HTTP, database, etc.)
2. Add parallel execution support
3. Add resource management (brackets)
4. Add effect cancellation
5. Add retry and timeout combinators
6. Add streaming effects
