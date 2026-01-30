# Migration Guide: From Async/Await to Effects

This guide shows how to migrate existing FunctionalScript code that uses `async/await` or Promises to use the new Effects system.

## Why Migrate?

The Effects system provides:
- **Pure code**: All effect-producing code is referentially transparent
- **Better testability**: Test I/O code without mocking frameworks
- **Composability**: Use standard functional combinators
- **Type safety**: Full type inference without Promise wrappers

## Basic Patterns

### Pattern 1: Simple Async Function

**Before:**
```typescript
const readConfig = async (path: string): Promise<string> => {
    return await fs.readFile(path, 'utf-8')
}
```

**After:**
```typescript
import * as NodeEff from './effects/node/module.f.ts'

const readConfig = (path: string): Effect<string> =>
    NodeEff.readFile(path)
```

**Key changes:**
- Remove `async` keyword
- Remove `await` keyword
- Replace `Promise<T>` with `Effect<T>`
- Replace `fs.readFile` with `NodeEff.readFile`

### Pattern 2: Sequential Operations

**Before:**
```typescript
const copyFile = async (src: string, dest: string): Promise<void> => {
    const content = await fs.readFile(src, 'utf-8')
    await fs.writeFile(dest, content, 'utf-8')
}
```

**After:**
```typescript
import * as Effect from './effects/module.f.ts'
import * as NodeEff from './effects/node/module.f.ts'

const copyFile = (src: string) => (dest: string): Effect<void> =>
    Effect.flatMap((content: string) =>
        NodeEff.writeFile(dest)(content)
    )(NodeEff.readFile(src))
```

**Key changes:**
- Use `Effect.flatMap` instead of `await`
- Chain operations using continuation passing
- Curry function parameters for better composition

### Pattern 3: Transform Data Between Operations

**Before:**
```typescript
const processFile = async (input: string, output: string): Promise<void> => {
    const content = await fs.readFile(input, 'utf-8')
    const processed = content.toUpperCase()
    await fs.writeFile(output, processed, 'utf-8')
}
```

**After:**
```typescript
const processFile = (input: string) => (output: string): Effect<void> =>
    Effect.flatMap((content: string) =>
        NodeEff.writeFile(output)(content.toUpperCase())
    )(NodeEff.readFile(input))
```

**Key changes:**
- Transformations happen in the continuation
- No intermediate variables needed
- Data flows through the effect chain

### Pattern 4: Conditional Logic

**Before:**
```typescript
const safeRead = async (path: string): Promise<string | null> => {
    const exists = await fs.access(path).then(() => true).catch(() => false)
    if (exists) {
        return await fs.readFile(path, 'utf-8')
    }
    return null
}
```

**After:**
```typescript
const safeRead = (path: string): Effect<string | null> =>
    Effect.flatMap((exists: boolean) =>
        exists
            ? Effect.map((content: string) => content as string | null)(
                NodeEff.readFile(path)
            )
            : Effect.pure(null)
    )(NodeEff.fileExists(path))
```

**Key changes:**
- Use `flatMap` to branch on effect results
- Use ternary operator for conditional effects
- Use `Effect.pure` for immediate values

### Pattern 5: Error Handling

**Before:**
```typescript
const readWithDefault = async (path: string, defaultValue: string): Promise<string> => {
    try {
        return await fs.readFile(path, 'utf-8')
    } catch {
        return defaultValue
    }
}
```

**After:**
```typescript
const readWithDefault = (path: string) => (defaultValue: string): Effect<string> =>
    Effect.flatMap((exists: boolean) =>
        exists
            ? NodeEff.readFile(path)
            : Effect.pure(defaultValue)
    )(NodeEff.fileExists(path))
```

**Key changes:**
- Replace try/catch with conditional logic
- Check existence before reading
- Use `Effect.pure` for default values

### Pattern 6: Processing Multiple Items

**Before:**
```typescript
const readAll = async (paths: string[]): Promise<string[]> => {
    const results: string[] = []
    for (const path of paths) {
        const content = await fs.readFile(path, 'utf-8')
        results.push(content)
    }
    return results
}
```

**After:**
```typescript
const readAll = (paths: readonly string[]): Effect<readonly string[]> =>
    Effect.traverse(NodeEff.readFile)(paths)
```

**Key changes:**
- Use `traverse` instead of loops
- No mutation (no `push`)
- More concise and declarative

### Pattern 7: Map and Filter

**Before:**
```typescript
const processFiles = async (paths: string[]): Promise<string[]> => {
    const results: string[] = []
    for (const path of paths) {
        const exists = await fs.access(path).then(() => true).catch(() => false)
        if (exists) {
            const content = await fs.readFile(path, 'utf-8')
            results.push(content.toUpperCase())
        }
    }
    return results
}
```

**After:**
```typescript
const processFiles = (paths: readonly string[]): Effect<readonly string[]> =>
    Effect.flatMap((existingPaths: readonly string[]) =>
        Effect.map((contents: readonly string[]) =>
            contents.map(Str.toUpperCase)
        )(Effect.traverse(NodeEff.readFile)(existingPaths))
    )(Effect.filterM((path: string) =>
        NodeEff.fileExists(path)
    )(paths))
```

**Key changes:**
- Use `filterM` for effectful filtering
- Use `traverse` for mapping with effects
- Use regular `map` for pure transformations

### Pattern 8: Dependency Injection

**Before:**
```typescript
type FileReader = (path: string) => Promise<string>

const processWithDI = (readFile: FileReader) => 
    async (path: string): Promise<void> => {
        const content = await readFile(path)
        console.log(content)
    }

// Usage
const prod = processWithDI((path) => fs.readFile(path, 'utf-8'))
const test = processWithDI((path) => Promise.resolve('mock content'))
```

**After:**
```typescript
const process = (path: string): Effect<void> =>
    Effect.flatMap((content: string) =>
        NodeEff.stdOut(content)
    )(NodeEff.readFile(path))

// Testing - mock by running with different interpreter
import { runMock } from './effects/node/module.ts'

const mockHandlers = {
    readFile: () => 'mock content',
    stdOut: () => undefined
}

const result = await runMock(mockHandlers, process('/path'))
```

**Key changes:**
- No dependency injection needed
- Code stays pure
- Mock at the interpreter level, not the function level

## Complex Examples

### Example 1: Multi-step Pipeline

**Before:**
```typescript
const pipeline = async (input: string, output: string): Promise<void> => {
    const content = await fs.readFile(input, 'utf-8')
    const lines = content.split('\n')
    const filtered = lines.filter(line => line.length > 0)
    const processed = filtered.map(line => line.toUpperCase())
    const result = processed.join('\n')
    await fs.writeFile(output, result, 'utf-8')
    console.log(`Processed ${filtered.length} lines`)
}
```

**After:**
```typescript
const pipeline = (input: string) => (output: string): Effect<void> =>
    Effect.flatMap((content: string) => {
        const lines = Str.split('\n')(content)
        const filtered = Arr.filter((line: string) => !Str.isEmpty(line))(lines)
        const processed = Arr.map(Str.toUpperCase)(filtered)
        const result = Str.join('\n')(processed)
        
        return Effect.flatMap(() =>
            NodeEff.stdOut(`Processed ${Arr.length(filtered)} lines\n`)
        )(NodeEff.writeFile(output)(result))
    })(NodeEff.readFile(input))
```

### Example 2: Recursive Directory Processing

**Before:**
```typescript
const processDir = async (dir: string): Promise<void> => {
    const entries = await fs.readdir(dir)
    for (const entry of entries) {
        const fullPath = `${dir}/${entry}`
        const stat = await fs.stat(fullPath)
        if (stat.isDirectory()) {
            await processDir(fullPath)
        } else {
            const content = await fs.readFile(fullPath, 'utf-8')
            console.log(`${fullPath}: ${content.length} chars`)
        }
    }
}
```

**After:**
```typescript
const processDir = (dir: string): Effect<void> =>
    Effect.flatMap((entries: readonly string[]) => {
        const processEntry = (entry: string): Effect<void> => {
            const fullPath = `${dir}/${entry}`
            // Simplified: check if it's a file by extension
            const isFile = Str.includes('.')(entry)
            
            return isFile
                ? Effect.flatMap((content: string) =>
                    NodeEff.stdOut(`${fullPath}: ${Str.length(content)} chars\n`)
                )(NodeEff.readFile(fullPath))
                : processDir(fullPath)
        }
        
        return Effect.flatMap(() => Effect.pure(undefined))(
            Effect.sequence(Arr.map(processEntry)(entries))
        )
    })(NodeEff.readDir(dir))
```

## Testing Migration

### Before: Testing with Mocks

```typescript
// Complex mocking setup
const mockFs = {
    readFile: jest.fn(),
    writeFile: jest.fn()
}

test('copyFile', async () => {
    mockFs.readFile.mockResolvedValue('content')
    mockFs.writeFile.mockResolvedValue(undefined)
    
    await copyFile(mockFs)('input.txt', 'output.txt')
    
    expect(mockFs.readFile).toHaveBeenCalledWith('input.txt', 'utf-8')
    expect(mockFs.writeFile).toHaveBeenCalledWith('output.txt', 'content', 'utf-8')
})
```

### After: Testing Pure Functions

```typescript
// No mocking needed - test the pure structure
test('copyFile', () => {
    const effect = copyFile('input.txt')('output.txt')
    
    // Test structure
    assertEqual(effect[0], 'readFile')
    assertEqual(effect[1], 'input.txt')
    
    // Test continuation
    const afterRead = effect[2]('test content')
    assertEqual(afterRead[0], 'writeFile')
    assertEqual(afterRead[1], { path: 'output.txt', content: 'test content' })
})
```

## Common Pitfalls

### Pitfall 1: Forgetting to Use flatMap

**Wrong:**
```typescript
const bad = (path: string): Effect<string> => {
    const content = NodeEff.readFile(path) // Returns Effect<string>
    return Effect.pure(content.toUpperCase()) // Type error!
}
```

**Correct:**
```typescript
const good = (path: string): Effect<string> =>
    Effect.map(Str.toUpperCase)(NodeEff.readFile(path))
```

### Pitfall 2: Mixing Async and Effects

**Wrong:**
```typescript
const bad = async (path: string): Promise<Effect<string>> => {
    // Don't mix async/await with effects!
    const exists = await fs.access(path).then(() => true).catch(() => false)
    return exists ? NodeEff.readFile(path) : Effect.pure('')
}
```

**Correct:**
```typescript
const good = (path: string): Effect<string> =>
    Effect.flatMap((exists: boolean) =>
        exists ? NodeEff.readFile(path) : Effect.pure('')
    )(NodeEff.fileExists(path))
```

### Pitfall 3: Using Mutation

**Wrong:**
```typescript
const bad = (paths: readonly string[]): Effect<readonly string[]> => {
    const results: string[] = [] // Mutation!
    return Effect.flatMap(() => {
        for (const path of paths) {
            // Can't await in a pure function
        }
        return Effect.pure(results)
    })(Effect.pure(undefined))
}
```

**Correct:**
```typescript
const good = (paths: readonly string[]): Effect<readonly string[]> =>
    Effect.traverse(NodeEff.readFile)(paths)
```

## Quick Reference

| Async Pattern | Effect Pattern |
|--------------|----------------|
| `async () => T` | `() => Effect<T>` |
| `await effect` | `Effect.flatMap(continuation)(effect)` |
| `const x = await e` | `Effect.flatMap((x) => ...)(e)` |
| `return value` | `Effect.pure(value)` |
| `try/catch` | `Effect.flatMap` with conditionals |
| `Promise.all(arr)` | `Effect.sequence(arr)` |
| `arr.map(async f)` | `Effect.traverse(f)(arr)` |
| Dependency injection | Mock at interpreter level |

## Checklist

When migrating a module:

- [ ] Remove all `async` keywords
- [ ] Remove all `await` keywords
- [ ] Replace `Promise<T>` with `Effect<T>`
- [ ] Replace I/O calls with effect constructors
- [ ] Use `flatMap` for sequencing
- [ ] Use `map` for transformations
- [ ] Use `traverse` for mapping arrays
- [ ] Use `sequence` for collecting effects
- [ ] Update tests to test pure structures
- [ ] Add `.f.ts` extension to indicate functional purity
