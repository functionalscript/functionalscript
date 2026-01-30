/**
 * Array utilities
 * Pure functional array operations
 */

/**
 * Map over an array
 */
export const map = <A, B>(f: (a: A) => B) => (arr: readonly A[]): readonly B[] =>
    arr.map(f)

/**
 * Filter an array
 */
export const filter = <T>(predicate: (t: T) => boolean) => (arr: readonly T[]): readonly T[] =>
    arr.filter(predicate)

/**
 * Reduce an array
 */
export const reduce = <A, B>(f: (acc: B, a: A) => B) => (initial: B) => (arr: readonly A[]): B =>
    arr.reduce(f, initial)

/**
 * Find first element matching predicate
 */
export const find = <T>(predicate: (t: T) => boolean) => (arr: readonly T[]): T | undefined =>
    arr.find(predicate)

/**
 * Check if any element matches predicate
 */
export const some = <T>(predicate: (t: T) => boolean) => (arr: readonly T[]): boolean =>
    arr.some(predicate)

/**
 * Check if all elements match predicate
 */
export const every = <T>(predicate: (t: T) => boolean) => (arr: readonly T[]): boolean =>
    arr.every(predicate)

/**
 * Get first element
 */
export const head = <T>(arr: readonly T[]): T | undefined =>
    arr[0]

/**
 * Get last element
 */
export const last = <T>(arr: readonly T[]): T | undefined =>
    arr[arr.length - 1]

/**
 * Get all elements except the first
 */
export const tail = <T>(arr: readonly T[]): readonly T[] =>
    arr.slice(1)

/**
 * Get all elements except the last
 */
export const init = <T>(arr: readonly T[]): readonly T[] =>
    arr.slice(0, -1)

/**
 * Take first n elements
 */
export const take = (n: number) => <T>(arr: readonly T[]): readonly T[] =>
    arr.slice(0, n)

/**
 * Drop first n elements
 */
export const drop = (n: number) => <T>(arr: readonly T[]): readonly T[] =>
    arr.slice(n)

/**
 * Concatenate two arrays
 */
export const concat = <T>(a: readonly T[]) => (b: readonly T[]): readonly T[] =>
    [...a, ...b]

/**
 * Flatten array of arrays
 */
export const flatten = <T>(arr: readonly (readonly T[])[]): readonly T[] =>
    arr.flat()

/**
 * Reverse an array
 */
export const reverse = <T>(arr: readonly T[]): readonly T[] =>
    [...arr].reverse()

/**
 * Check if array is empty
 */
export const isEmpty = <T>(arr: readonly T[]): boolean =>
    arr.length === 0

/**
 * Get array length
 */
export const length = <T>(arr: readonly T[]): number =>
    arr.length

/**
 * Zip two arrays together
 */
export const zip = <A, B>(a: readonly A[]) => (b: readonly B[]): readonly (readonly [A, B])[] => {
    const minLen = Math.min(a.length, b.length)
    const result: (readonly [A, B])[] = []
    for (let i = 0; i < minLen; i++) {
        result.push([a[i], b[i]] as const)
    }
    return result
}

/**
 * Unzip an array of pairs
 */
export const unzip = <A, B>(arr: readonly (readonly [A, B])[]): readonly [readonly A[], readonly B[]] => {
    const as: A[] = []
    const bs: B[] = []
    for (const [a, b] of arr) {
        as.push(a)
        bs.push(b)
    }
    return [as, bs] as const
}

/**
 * Create a range of numbers
 */
export const range = (start: number) => (end: number): readonly number[] => {
    const result: number[] = []
    for (let i = start; i < end; i++) {
        result.push(i)
    }
    return result
}

/**
 * Remove duplicates from array
 */
export const unique = <T>(arr: readonly T[]): readonly T[] =>
    [...new Set(arr)]

/**
 * Sort array with comparator
 */
export const sortWith = <T>(comparator: (a: T, b: T) => number) => (arr: readonly T[]): readonly T[] =>
    [...arr].sort(comparator)

/**
 * Partition array based on predicate
 */
export const partition = <T>(predicate: (t: T) => boolean) => (arr: readonly T[]): readonly [readonly T[], readonly T[]] => {
    const trueArr: T[] = []
    const falseArr: T[] = []
    for (const item of arr) {
        if (predicate(item)) {
            trueArr.push(item)
        } else {
            falseArr.push(item)
        }
    }
    return [trueArr, falseArr] as const
}
