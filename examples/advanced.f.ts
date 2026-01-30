/**
 * Advanced Examples of Effects as Data
 * 
 * These examples demonstrate real-world usage patterns of the effects system.
 */

import * as Effect from '../effects/module.f.ts'
import * as NodeEff from '../effects/node/module.f.ts'
import * as Arr from '../array/module.f.ts'
import * as Str from '../string/module.f.ts'

/**
 * Example 1: Build System
 * Compile multiple source files and report results
 */
export type CompileResult = {
    readonly file: string
    readonly success: boolean
    readonly errors: readonly string[]
}

const compileFile = (path: string): Effect.Effect<CompileResult> =>
    Effect.flatMap((content: string) => {
        // Simulate compilation
        const hasErrors = Str.includes('ERROR')(content)
        const errors = hasErrors ? ['Syntax error in ' + path] : []
        
        return Effect.pure({
            file: path,
            success: !hasErrors,
            errors
        })
    })(NodeEff.readFile(path))

export const buildProject = (sourceFiles: readonly string[]): Effect.Effect<readonly CompileResult[]> =>
    Effect.traverse(compileFile)(sourceFiles)

export const reportBuildResults = (results: readonly CompileResult[]): Effect.Effect<number> => {
    const failed = Arr.filter((r: CompileResult) => !r.success)(results)
    
    if (Arr.isEmpty(failed)) {
        return Effect.flatMap(() => 
            NodeEff.exit(0)
        )(NodeEff.stdOut('✓ Build successful\n'))
    }
    
    const errorMessages = Arr.map((r: CompileResult) => 
        `✗ ${r.file}\n${Str.join('\n')(r.errors)}`
    )(failed)
    
    return Effect.flatMap(() =>
        Effect.flatMap(() =>
            NodeEff.exit(1)
        )(NodeEff.stdErr('\nBuild failed\n'))
    )(NodeEff.stdErr(Str.join('\n\n')(errorMessages) + '\n'))
}

/**
 * Example 2: File Processor with Validation
 * Read files, validate content, and write results
 */
export type ValidationResult = {
    readonly valid: boolean
    readonly errors: readonly string[]
}

const validateJSON = (content: string): ValidationResult => {
    try {
        JSON.parse(content)
        return { valid: true, errors: [] }
    } catch (e) {
        return { 
            valid: false, 
            errors: [`Invalid JSON: ${(e as Error).message}`] 
        }
    }
}

export const processJSONFile = (inputPath: string) => (outputPath: string): Effect.Effect<void> =>
    Effect.flatMap((content: string) => {
        const validation = validateJSON(content)
        
        if (!validation.valid) {
            return Effect.flatMap(() =>
                Effect.pure(undefined)
            )(NodeEff.stdErr(`Validation failed: ${inputPath}\n${Str.join('\n')(validation.errors)}\n`))
        }
        
        // Transform the JSON (e.g., pretty print)
        const parsed = JSON.parse(content)
        const formatted = JSON.stringify(parsed, null, 2)
        
        return Effect.flatMap(() =>
            NodeEff.stdOut(`Processed: ${inputPath} -> ${outputPath}\n`)
        )(NodeEff.writeFile(outputPath)(formatted))
    })(NodeEff.readFile(inputPath))

/**
 * Example 3: Directory Walker
 * Recursively process all files in a directory
 */
export const processDirectory = (
    dir: string,
    processFile: (path: string) => Effect.Effect<void>
): Effect.Effect<void> =>
    Effect.flatMap((entries: readonly string[]) => {
        const fullPaths = Arr.map((entry: string) => `${dir}/${entry}`)(entries)
        
        // Process each entry
        const effects = Arr.map((path: string) =>
            Effect.flatMap((isFile: boolean) =>
                isFile
                    ? processFile(path)
                    : processDirectory(path, processFile) // Recursive
            )(isFileEffect(path))
        )(fullPaths)
        
        return Effect.flatMap(() => Effect.pure(undefined))(
            Effect.sequence(effects)
        )
    })(NodeEff.readDir(dir))

// Helper to check if path is a file (simplified - in reality would use fs.stat)
const isFileEffect = (path: string): Effect.Effect<boolean> =>
    Effect.pure(!path.endsWith('/') && Str.includes('.')(path))

/**
 * Example 4: Configuration Manager
 * Load and merge configuration from multiple sources
 */
export type Config = {
    readonly [key: string]: string | number | boolean
}

const parseConfig = (content: string): Config => {
    try {
        return JSON.parse(content) as Config
    } catch {
        return {}
    }
}

const mergeConfigs = (configs: readonly Config[]): Config =>
    Arr.reduce((acc: Config, config: Config) => ({ ...acc, ...config }))({})(configs)

export const loadConfiguration = (
    paths: readonly string[]
): Effect.Effect<Config> =>
    Effect.map(mergeConfigs)(
        Effect.traverse((path: string) =>
            Effect.flatMap((exists: boolean) =>
                exists
                    ? Effect.map(parseConfig)(NodeEff.readFile(path))
                    : Effect.pure({} as Config)
            )(NodeEff.fileExists(path))
        )(paths)
    )

/**
 * Example 5: Batch File Operations
 * Read multiple files, transform, and write to output directory
 */
export const batchTransform = (
    inputFiles: readonly string[],
    outputDir: string,
    transform: (content: string) => string
): Effect.Effect<void> => {
    const processOne = (inputPath: string): Effect.Effect<void> => {
        const filename = inputPath.substring(inputPath.lastIndexOf('/') + 1)
        const outputPath = `${outputDir}/${filename}`
        
        return Effect.flatMap((content: string) =>
            Effect.flatMap(() =>
                NodeEff.stdOut(`Transformed: ${inputPath}\n`)
            )(NodeEff.writeFile(outputPath)(transform(content)))
        )(NodeEff.readFile(inputPath))
    }
    
    return Effect.flatMap(() =>
        Effect.flatMap(() =>
            Effect.pure(undefined)
        )(Effect.sequence(Arr.map(processOne)(inputFiles)))
    )(NodeEff.mkDir(outputDir)(true))
}

/**
 * Example 6: Error Recovery
 * Try multiple fallback options until one succeeds
 */
export const readFileWithFallbacks = (
    paths: readonly string[]
): Effect.Effect<string | null> => {
    const tryRead = (remaining: readonly string[]): Effect.Effect<string | null> => {
        if (Arr.isEmpty(remaining)) {
            return Effect.pure(null)
        }
        
        const [head, ...tail] = remaining
        
        return Effect.flatMap((exists: boolean) =>
            exists
                ? Effect.map((content: string) => content as string | null)(
                    NodeEff.readFile(head)
                )
                : tryRead(tail)
        )(NodeEff.fileExists(head))
    }
    
    return tryRead(paths)
}

/**
 * Example 7: Logging with Context
 * Add contextual logging to effect chains
 */
export type LogLevel = 'info' | 'warn' | 'error'

export const log = (level: LogLevel) => (message: string): Effect.Effect<void> => {
    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`
    const output = level === 'error' ? NodeEff.stdErr : NodeEff.stdOut
    return output(`${prefix} ${message}\n`)
}

export const withLogging = <T>(
    description: string,
    effect: Effect.Effect<T>
): Effect.Effect<T> =>
    Effect.flatMap(() =>
        Effect.flatMap((result: T) =>
            Effect.flatMap(() =>
                Effect.pure(result)
            )(log('info')(`Completed: ${description}`))
        )(effect)
    )(log('info')(`Starting: ${description}`))

/**
 * Example 8: Resource Management
 * Ensure cleanup happens even if operations fail
 */
export type Resource<T> = {
    readonly acquire: Effect.Effect<T>
    readonly release: (resource: T) => Effect.Effect<void>
    readonly use: (resource: T) => Effect.Effect<unknown>
}

export const bracket = <T>(resource: Resource<T>): Effect.Effect<void> =>
    Effect.flatMap((acquired: T) =>
        Effect.flatMap((result: unknown) =>
            // Always release, even if use failed
            resource.release(acquired)
        )(resource.use(acquired))
    )(resource.acquire)

/**
 * Example 9: Conditional Effects
 * Execute different effects based on runtime conditions
 */
export const conditionalProcess = (
    path: string,
    condition: (content: string) => boolean,
    onTrue: (content: string) => Effect.Effect<void>,
    onFalse: (content: string) => Effect.Effect<void>
): Effect.Effect<void> =>
    Effect.flatMap((content: string) =>
        condition(content) ? onTrue(content) : onFalse(content)
    )(NodeEff.readFile(path))

/**
 * Example 10: Collecting Results
 * Process files and collect statistics
 */
export type FileStats = {
    readonly path: string
    readonly lineCount: number
    readonly wordCount: number
    readonly charCount: number
}

const analyzeFile = (path: string): Effect.Effect<FileStats> =>
    Effect.map((content: string) => {
        const lines = Str.split('\n')(content)
        const words = Str.split(/\s+/)(content)
        
        return {
            path,
            lineCount: Arr.length(lines),
            wordCount: Arr.length(words),
            charCount: Str.length(content)
        }
    })(NodeEff.readFile(path))

export const analyzeProject = (
    files: readonly string[]
): Effect.Effect<readonly FileStats[]> =>
    Effect.traverse(analyzeFile)(files)

export const printAnalysis = (stats: readonly FileStats[]): Effect.Effect<void> => {
    const totalLines = Arr.reduce((sum: number, s: FileStats) => sum + s.lineCount)(0)(stats)
    const totalWords = Arr.reduce((sum: number, s: FileStats) => sum + s.wordCount)(0)(stats)
    const totalChars = Arr.reduce((sum: number, s: FileStats) => sum + s.charCount)(0)(stats)
    
    const report = `
Project Analysis:
  Files: ${Arr.length(stats)}
  Total Lines: ${totalLines}
  Total Words: ${totalWords}
  Total Characters: ${totalChars}

Per File:
${Arr.map((s: FileStats) => `  ${s.path}: ${s.lineCount} lines`)(stats).join('\n')}
`
    
    return NodeEff.stdOut(report)
}
