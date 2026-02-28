/**
 * Effects as Data - A purely functional approach to I/O
 * 
 * This module provides types and combinators for representing side effects
 * as pure data structures. Effects are descriptions of what should happen,
 * not the actual execution. This allows:
 * 
 * 1. Pure functional code that describes I/O operations
 * 2. Easy testing through mock interpreters
 * 3. Composition of effects without executing them
 */

// Effect discriminant tags
export type ReadFileTag = 'readFile'
export type WriteFileTag = 'writeFile'
export type ReadDirTag = 'readDir'
export type ExitTag = 'exit'
export type LogTag = 'log'
export type ErrorTag = 'error'
export type GetArgsTag = 'getArgs'
export type GetEnvTag = 'getEnv'
export type PureTag = 'pure'
export type FlatMapTag = 'flatMap'

export const readFileTag: ReadFileTag = 'readFile'
export const writeFileTag: WriteFileTag = 'writeFile'
export const readDirTag: ReadDirTag = 'readDir'
export const exitTag: ExitTag = 'exit'
export const logTag: LogTag = 'log'
export const errorTag: ErrorTag = 'error'
export const getArgsTag: GetArgsTag = 'getArgs'
export const getEnvTag: GetEnvTag = 'getEnv'
export const pureTag: PureTag = 'pure'
export const flatMapTag: FlatMapTag = 'flatMap'

// Primitive effect types
export type ReadFile = readonly [ReadFileTag, string]
export type WriteFile = readonly [WriteFileTag, string, string]
export type ReadDir = readonly [ReadDirTag, string]
export type Exit = readonly [ExitTag, number]
export type Log = readonly [LogTag, string]
export type Error = readonly [ErrorTag, string]
export type GetArgs = readonly [GetArgsTag]
export type GetEnv = readonly [GetEnvTag, string]

// Result types for effects
export type ReadFileResult = string | null
export type WriteFileResult = boolean
export type ReadDirResult = readonly string[] | null
export type ExitResult = never
export type LogResult = void
export type ErrorResult = void
export type GetArgsResult = readonly string[]
export type GetEnvResult = string | undefined

// Primitive effects (leaf nodes)
export type PrimitiveEffect =
    | ReadFile
    | WriteFile
    | ReadDir
    | Exit
    | Log
    | Error
    | GetArgs
    | GetEnv

// Effect result type mapping
export type EffectResult<E extends PrimitiveEffect> =
    E extends ReadFile ? ReadFileResult :
    E extends WriteFile ? WriteFileResult :
    E extends ReadDir ? ReadDirResult :
    E extends Exit ? ExitResult :
    E extends Log ? LogResult :
    E extends Error ? ErrorResult :
    E extends GetArgs ? GetArgsResult :
    E extends GetEnv ? GetEnvResult :
    never

// Pure effect - wraps a value
export type Pure<A> = readonly [PureTag, A]

// FlatMap effect - sequences effects
export type FlatMap<A, B> = readonly [FlatMapTag, Effect<A>, (a: A) => Effect<B>]

// Complete Effect type
export type Effect<A> =
    | Pure<A>
    | FlatMap<unknown, A>
    | (A extends ReadFileResult ? ReadFile : never)
    | (A extends WriteFileResult ? WriteFile : never)
    | (A extends ReadDirResult ? ReadDir : never)
    | (A extends never ? Exit : never)
    | (A extends void ? Log : never)
    | (A extends void ? Error : never)
    | (A extends GetArgsResult ? GetArgs : never)
    | (A extends GetEnvResult ? GetEnv : never)

// Simpler union for pattern matching
export type AnyEffect<A> =
    | Pure<A>
    | FlatMap<unknown, A>
    | PrimitiveEffect

// Constructors for primitive effects
export const readFile = (path: string): ReadFile =>
    [readFileTag, path]

export const writeFile = (path: string, content: string): WriteFile =>
    [writeFileTag, path, content]

export const readDir = (path: string): ReadDir =>
    [readDirTag, path]

export const exit = (code: number): Exit =>
    [exitTag, code]

export const log = (message: string): Log =>
    [logTag, message]

export const error = (message: string): Error =>
    [errorTag, message]

export const getArgs: GetArgs =
    [getArgsTag]

export const getEnv = (name: string): GetEnv =>
    [getEnvTag, name]

// Pure effect constructor
export const pure = <A>(value: A): Pure<A> =>
    [pureTag, value]

// FlatMap constructor (monadic bind)
export const flatMap = <A, B>(
    effect: Effect<A>,
    f: (a: A) => Effect<B>
): FlatMap<A, B> =>
    [flatMapTag, effect, f] as FlatMap<A, B>

// Map combinator (functor)
export const map = <A, B>(
    effect: Effect<A>,
    f: (a: A) => B
): Effect<B> =>
    flatMap(effect, a => pure(f(a)))

// Sequence combinator - run effects in order, keep last result
export const andThen = <A, B>(
    first: Effect<A>,
    second: Effect<B>
): Effect<B> =>
    flatMap(first, () => second)

// Sequence combinator - run effects in order, keep first result
export const before = <A, B>(
    first: Effect<A>,
    second: Effect<B>
): Effect<A> =>
    flatMap(first, a => map(second, () => a))

// Fold over an array of values with effects
export const foldEffect = <A, B>(
    values: readonly A[],
    initial: B,
    f: (acc: B, value: A) => Effect<B>
): Effect<B> =>
    values.length === 0
        ? pure(initial)
        : flatMap(
            f(initial, values[0]),
            newAcc => foldEffect(values.slice(1), newAcc, f)
        )

// Traverse - map a function over an array and sequence the effects
export const traverse = <A, B>(
    values: readonly A[],
    f: (a: A) => Effect<B>
): Effect<readonly B[]> =>
    foldEffect(
        values,
        [] as readonly B[],
        (acc, a) => map(f(a), b => [...acc, b])
    )

// Sequence - turn an array of effects into an effect of array
export const sequence = <A>(
    effects: readonly Effect<A>[]
): Effect<readonly A[]> =>
    traverse(effects, e => e)

// ForEach - run an effect for each value, discard results
export const forEach = <A>(
    values: readonly A[],
    f: (a: A) => Effect<void>
): Effect<void> =>
    foldEffect(
        values,
        undefined as void,
        (_, a) => f(a)
    )

// Helper to get the tag from any effect
export const getTag = <A>(effect: AnyEffect<A>): string =>
    effect[0]

// Type guard for Pure
export const isPure = <A>(effect: AnyEffect<A>): effect is Pure<A> =>
    effect[0] === pureTag

// Type guard for FlatMap
export const isFlatMap = <A>(effect: AnyEffect<A>): effect is FlatMap<unknown, A> =>
    effect[0] === flatMapTag

// Type guard for primitive effects
export const isPrimitive = <A>(effect: AnyEffect<A>): effect is PrimitiveEffect =>
    !isPure(effect) && !isFlatMap(effect)
