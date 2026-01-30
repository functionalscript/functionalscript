# Quick Start Guide

Get started with FunctionalScript Effects in 5 minutes.

## Installation

```bash
# Clone or copy the effects system into your project
cp -r functionalscript-effects ./effects

# Install dependencies (if using as standalone)
cd effects
npm install
```

## Basic Usage

### Step 1: Import the modules

```typescript
import * as Effect from './effects/module.f.ts'
import * as NodeEff from './effects/node/module.f.ts'
```

### Step 2: Create effects (pure code)

```typescript
// Read a file
const readConfig: Effect.Effect<string> = 
    NodeEff.readFile('config.json')

// Chain effects
const displayConfig: Effect.Effect<void> = 
    Effect.flatMap((content: string) =>
        NodeEff.stdOut(`Config: ${content}\n`)
    )(readConfig)
```

### Step 3: Run effects (impure code)

```typescript
import { runEffect } from './effects/node/module.ts'

// This is the only impure part
await runEffect(displayConfig)
```

## Common Patterns

### Reading and Writing Files

```typescript
const copyFile = (src: string) => (dest: string): Effect.Effect<void> =>
    Effect.flatMap((content: string) =>
        NodeEff.writeFile(dest)(content)
    )(NodeEff.readFile(src))

// Usage
const effect = copyFile('input.txt')('output.txt')
await runEffect(effect)
```

### Conditional Logic

```typescript
const safeRead = (path: string): Effect.Effect<string> =>
    Effect.flatMap((exists: boolean) =>
        exists
            ? NodeEff.readFile(path)
            : Effect.pure('File not found')
    )(NodeEff.fileExists(path))
```

### Processing Multiple Files

```typescript
const readAll = (paths: readonly string[]): Effect.Effect<readonly string[]> =>
    Effect.traverse(NodeEff.readFile)(paths)

// Usage
const files = ['file1.txt', 'file2.txt', 'file3.txt']
const contents = await runEffect(readAll(files))
```

### Transforming Data

```typescript
const processFile = (path: string): Effect.Effect<void> =>
    Effect.flatMap((content: string) => {
        const uppercase = content.toUpperCase()
        return NodeEff.stdOut(uppercase)
    })(NodeEff.readFile(path))
```

## Testing

### Test the structure (no I/O needed)

```typescript
const effect = copyFile('in.txt')('out.txt')

// Test it's a readFile effect
assertEqual(effect[0], 'readFile')
assertEqual(effect[1], 'in.txt')

// Test the continuation
const afterRead = effect[2]('content')
assertEqual(afterRead[0], 'writeFile')
```

### Mock effects for testing

```typescript
import { runMock } from './effects/node/module.ts'

const handlers = {
    readFile: () => 'mocked content',
    writeFile: () => undefined,
}

const result = await runMock(handlers, myEffect)
```

## Key Concepts

### Effects are Data

```typescript
// This doesn't read the file - it creates a description
const effect = NodeEff.readFile('file.txt')

// This is just data - you can inspect it
console.log(effect[0]) // 'readFile'
console.log(effect[1]) // 'file.txt'
```

### Composition with flatMap

```typescript
// Sequential operations
const program = 
    Effect.flatMap((content: string) =>
        Effect.flatMap(() =>
            NodeEff.stdOut('Done!\n')
        )(NodeEff.writeFile('out.txt')(content))
    )(NodeEff.readFile('in.txt'))
```

### Pure vs Impure

```typescript
// PURE - no side effects
const createEffect = (path: string): Effect.Effect<string> =>
    NodeEff.readFile(path)

// IMPURE - performs I/O
import { runEffect } from './effects/node/module.ts'
const main = async () => {
    await runEffect(createEffect('file.txt'))
}
```

## Available Effects

### File System
- `readFile(path)` - Read file as string
- `writeFile(path)(content)` - Write string to file
- `fileExists(path)` - Check if file exists
- `readDir(path)` - Read directory contents
- `deleteFile(path)` - Delete a file
- `mkDir(path)(recursive)` - Create directory

### Console
- `stdOut(message)` - Write to stdout
- `stdErr(message)` - Write to stderr
- `stdIn` - Read from stdin

### Process
- `getArgs` - Get command line arguments
- `getEnv(name)` - Get environment variable
- `exit(code)` - Exit with code

### Effect Combinators
- `pure(value)` - Create pure effect
- `map(f)(effect)` - Transform result
- `flatMap(f)(effect)` - Chain effects
- `sequence(effects)` - Array of effects → effect of array
- `traverse(f)(array)` - Map with effects

## Real Example: File Processor

```typescript
import * as Effect from './effects/module.f.ts'
import * as NodeEff from './effects/node/module.f.ts'

const processFile = (inputPath: string) => (outputPath: string): Effect.Effect<void> =>
    // Read the input file
    Effect.flatMap((content: string) => {
        // Transform the content
        const processed = content
            .split('\n')
            .filter(line => line.trim().length > 0)
            .map(line => line.toUpperCase())
            .join('\n')
        
        // Write to output file
        return Effect.flatMap(() =>
            // Log success
            NodeEff.stdOut(`Processed ${inputPath} -> ${outputPath}\n`)
        )(NodeEff.writeFile(outputPath)(processed))
    })(NodeEff.readFile(inputPath))

// Run it
import { runEffect } from './effects/node/module.ts'

const main = async () => {
    const effect = processFile('input.txt')('output.txt')
    await runEffect(effect)
}

main().catch(console.error)
```

## Next Steps

1. Read the [README.md](./README.md) for detailed documentation
2. Check out [examples/advanced.f.ts](./examples/advanced.f.ts) for real-world patterns
3. See [MIGRATION.md](./MIGRATION.md) if converting from async/await
4. Run tests: `npm test`

## Common Mistakes

### ❌ Don't await in pure code
```typescript
// WRONG - mixing async with effects
const bad = async (path: string) => {
    const content = await fs.readFile(path)
    return NodeEff.stdOut(content)
}
```

```typescript
// CORRECT - keep it pure
const good = (path: string): Effect.Effect<void> =>
    Effect.flatMap((content: string) =>
        NodeEff.stdOut(content)
    )(NodeEff.readFile(path))
```

### ❌ Don't forget flatMap
```typescript
// WRONG - content is Effect<string>, not string
const bad = (path: string): Effect.Effect<void> => {
    const content = NodeEff.readFile(path)
    return NodeEff.stdOut(content.toUpperCase()) // Type error!
}
```

```typescript
// CORRECT - use flatMap to access the string
const good = (path: string): Effect.Effect<void> =>
    Effect.flatMap((content: string) =>
        NodeEff.stdOut(content.toUpperCase())
    )(NodeEff.readFile(path))
```

### ❌ Don't use mutation
```typescript
// WRONG - mutating array
const bad = (paths: string[]): Effect.Effect<string[]> => {
    const results: string[] = []
    // Can't use forEach with effects anyway
    return Effect.pure(results)
}
```

```typescript
// CORRECT - use traverse
const good = (paths: readonly string[]): Effect.Effect<readonly string[]> =>
    Effect.traverse(NodeEff.readFile)(paths)
```

## Help & Resources

- Full documentation: [README.md](./README.md)
- Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Migration guide: [MIGRATION.md](./MIGRATION.md)
- Examples: [examples/](./examples/)
- Run tests: `npm test`

Happy functional programming! 🎉
