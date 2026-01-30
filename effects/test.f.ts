import * as Effect from './module.f.ts'

/**
 * Test utilities
 */
const assertEqual = <T>(actual: T, expected: T, message: string): void => {
    const actualStr = JSON.stringify(actual)
    const expectedStr = JSON.stringify(expected)
    if (actualStr !== expectedStr) {
        throw new Error(`${message}\nExpected: ${expectedStr}\nActual: ${actualStr}`)
    }
}

const assertPure = <T>(effect: Effect.Effect<T>, expected: T, message: string): void => {
    if (!Effect.isPure(effect)) {
        throw new Error(`${message}\nEffect is not pure`)
    }
    assertEqual(Effect.unsafeGetPure(effect), expected, message)
}

/**
 * Test pure
 */
export const testPure = (): void => {
    const effect = Effect.pure(42)
    assertPure(effect, 42, 'pure should create a pure effect')
}

/**
 * Test map with pure effect
 */
export const testMapPure = (): void => {
    const effect = Effect.pure(10)
    const mapped = Effect.map((x: number) => x * 2)(effect)
    assertPure(mapped, 20, 'map should transform pure effect value')
}

/**
 * Test map with impure effect
 */
export const testMapImpure = (): void => {
    const effect: Effect.Effect<number> = ['read', '/file.txt', (content: unknown) => Effect.pure(content as string)] as const
    const mapped = Effect.map((s: string) => s.length)(effect)
    
    assertEqual(mapped[0], 'read', 'map should preserve effect tag')
    assertEqual(mapped[1], '/file.txt', 'map should preserve effect payload')
    
    // Test continuation
    const result = mapped[2]('hello')
    assertPure(result, 5, 'map should transform continuation result')
}

/**
 * Test flatMap with pure effect
 */
export const testFlatMapPure = (): void => {
    const effect = Effect.pure(5)
    const flatMapped = Effect.flatMap((x: number) => Effect.pure(x + 3))(effect)
    assertPure(flatMapped, 8, 'flatMap should chain pure effects')
}

/**
 * Test flatMap with impure effect
 */
export const testFlatMapImpure = (): void => {
    const effect: Effect.Effect<string> = ['read', 'file.txt', (s: unknown) => Effect.pure(s as string)] as const
    const flatMapped = Effect.flatMap((s: string) => Effect.pure(s.toUpperCase()))(effect)
    
    assertEqual(flatMapped[0], 'read', 'flatMap should preserve effect tag')
    
    const result = flatMapped[2]('hello')
    assertPure(result, 'HELLO', 'flatMap should chain continuations')
}

/**
 * Test flatMap chaining
 */
export const testFlatMapChain = (): void => {
    const effect = Effect.pure(2)
    const chained = Effect.flatMap((x: number) => 
        Effect.flatMap((y: number) => 
            Effect.pure(x + y)
        )(Effect.pure(x * 3))
    )(effect)
    assertPure(chained, 8, 'flatMap should support chaining (2 + 2*3 = 8)')
}

/**
 * Test sequence with empty array
 */
export const testSequenceEmpty = (): void => {
    const effects: readonly Effect.Effect<number>[] = []
    const result = Effect.sequence(effects)
    assertPure(result, [], 'sequence should handle empty array')
}

/**
 * Test sequence with pure effects
 */
export const testSequencePure = (): void => {
    const effects = [Effect.pure(1), Effect.pure(2), Effect.pure(3)]
    const result = Effect.sequence(effects)
    assertPure(result, [1, 2, 3], 'sequence should collect pure effect values')
}

/**
 * Test sequence with mixed effects (manually tested structure)
 */
export const testSequenceMixed = (): void => {
    const eff1 = Effect.pure(1)
    const eff2: Effect.Effect<number> = ['compute', null, () => Effect.pure(2)] as const
    const effects = [eff1, eff2]
    const result = Effect.sequence(effects)
    
    // Result should be an effect
    assertEqual(Effect.isPure(result), false, 'sequence with impure effects should be impure')
}

/**
 * Test traverse with empty array
 */
export const testTraverseEmpty = (): void => {
    const arr: readonly number[] = []
    const result = Effect.traverse((x: number) => Effect.pure(x * 2))(arr)
    assertPure(result, [], 'traverse should handle empty array')
}

/**
 * Test traverse with pure effects
 */
export const testTraversePure = (): void => {
    const arr = [1, 2, 3]
    const result = Effect.traverse((x: number) => Effect.pure(x * 2))(arr)
    assertPure(result, [2, 4, 6], 'traverse should map and sequence')
}

/**
 * Test ap
 */
export const testAp = (): void => {
    const fn = Effect.pure((x: number) => x * 2)
    const val = Effect.pure(21)
    const result = Effect.ap(fn)(val)
    assertPure(result, 42, 'ap should apply effect function to effect value')
}

/**
 * Test liftA2
 */
export const testLiftA2 = (): void => {
    const add = (a: number) => (b: number) => a + b
    const result = Effect.liftA2(add)(Effect.pure(10))(Effect.pure(32))
    assertPure(result, 42, 'liftA2 should lift binary function')
}

/**
 * Test filterM with all true
 */
export const testFilterMAllTrue = (): void => {
    const arr = [1, 2, 3, 4]
    const isEven = (x: number) => Effect.pure(x % 2 === 0)
    const result = Effect.filterM(isEven)(arr)
    assertPure(result, [2, 4], 'filterM should filter even numbers')
}

/**
 * Test filterM with all false
 */
export const testFilterMAllFalse = (): void => {
    const arr = [1, 3, 5]
    const isEven = (x: number) => Effect.pure(x % 2 === 0)
    const result = Effect.filterM(isEven)(arr)
    assertPure(result, [], 'filterM should return empty for no matches')
}

/**
 * Test filterM with empty array
 */
export const testFilterMEmpty = (): void => {
    const arr: readonly number[] = []
    const alwaysTrue = (_: number) => Effect.pure(true)
    const result = Effect.filterM(alwaysTrue)(arr)
    assertPure(result, [], 'filterM should handle empty array')
}

/**
 * Test foldM with empty array
 */
export const testFoldMEmpty = (): void => {
    const arr: readonly number[] = []
    const add = (acc: number) => (x: number) => Effect.pure(acc + x)
    const result = Effect.foldM(add)(0)(arr)
    assertPure(result, 0, 'foldM should return initial value for empty array')
}

/**
 * Test foldM with sum
 */
export const testFoldMSum = (): void => {
    const arr = [1, 2, 3, 4]
    const add = (acc: number) => (x: number) => Effect.pure(acc + x)
    const result = Effect.foldM(add)(0)(arr)
    assertPure(result, 10, 'foldM should sum array')
}

/**
 * Test foldM with product
 */
export const testFoldMProduct = (): void => {
    const arr = [2, 3, 4]
    const multiply = (acc: number) => (x: number) => Effect.pure(acc * x)
    const result = Effect.foldM(multiply)(1)(arr)
    assertPure(result, 24, 'foldM should compute product')
}

/**
 * Test isPure
 */
export const testIsPure = (): void => {
    const pure = Effect.pure(42)
    const impure: Effect.Effect<string> = ['read', 'file', () => Effect.pure('data')] as const
    
    assertEqual(Effect.isPure(pure), true, 'isPure should identify pure effects')
    assertEqual(Effect.isPure(impure), false, 'isPure should identify impure effects')
}

/**
 * Test unsafeGetPure
 */
export const testUnsafeGetPure = (): void => {
    const effect = Effect.pure('hello')
    const value = Effect.unsafeGetPure(effect)
    assertEqual(value, 'hello', 'unsafeGetPure should extract value')
}

/**
 * Run all tests
 */
export const runTests = (): void => {
    const tests = [
        ['pure', testPure],
        ['map pure', testMapPure],
        ['map impure', testMapImpure],
        ['flatMap pure', testFlatMapPure],
        ['flatMap impure', testFlatMapImpure],
        ['flatMap chain', testFlatMapChain],
        ['sequence empty', testSequenceEmpty],
        ['sequence pure', testSequencePure],
        ['sequence mixed', testSequenceMixed],
        ['traverse empty', testTraverseEmpty],
        ['traverse pure', testTraversePure],
        ['ap', testAp],
        ['liftA2', testLiftA2],
        ['filterM all true', testFilterMAllTrue],
        ['filterM all false', testFilterMAllFalse],
        ['filterM empty', testFilterMEmpty],
        ['foldM empty', testFoldMEmpty],
        ['foldM sum', testFoldMSum],
        ['foldM product', testFoldMProduct],
        ['isPure', testIsPure],
        ['unsafeGetPure', testUnsafeGetPure],
    ] as const

    let passed = 0
    let failed = 0

    for (const [name, test] of tests) {
        try {
            test()
            passed++
            console.log(`✓ ${name}`)
        } catch (e) {
            failed++
            console.error(`✗ ${name}`)
            console.error(e)
        }
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed`)
    if (failed > 0) {
        throw new Error('Some tests failed')
    }
}

// Auto-run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
    runTests()
}
