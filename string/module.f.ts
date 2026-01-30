/**
 * String utilities
 * Pure functional string operations
 */

/**
 * Split a string by a delimiter
 */
export const split = (delimiter: string) => (str: string): readonly string[] =>
    str.split(delimiter)

/**
 * Join an array of strings with a delimiter
 */
export const join = (delimiter: string) => (arr: readonly string[]): string =>
    arr.join(delimiter)

/**
 * Trim whitespace from both ends of a string
 */
export const trim = (str: string): string =>
    str.trim()

/**
 * Check if a string starts with a prefix
 */
export const startsWith = (prefix: string) => (str: string): boolean =>
    str.startsWith(prefix)

/**
 * Check if a string ends with a suffix
 */
export const endsWith = (suffix: string) => (str: string): boolean =>
    str.endsWith(suffix)

/**
 * Convert string to lowercase
 */
export const toLowerCase = (str: string): string =>
    str.toLowerCase()

/**
 * Convert string to uppercase
 */
export const toUpperCase = (str: string): string =>
    str.toUpperCase()

/**
 * Check if string contains a substring
 */
export const includes = (substring: string) => (str: string): boolean =>
    str.includes(substring)

/**
 * Replace all occurrences of a pattern
 */
export const replace = (pattern: string | RegExp) => (replacement: string) => (str: string): string =>
    str.replace(new RegExp(pattern, 'g'), replacement)

/**
 * Get substring from start to end index
 */
export const substring = (start: number) => (end: number) => (str: string): string =>
    str.substring(start, end)

/**
 * Concatenate two strings
 */
export const concat = (a: string) => (b: string): string =>
    a + b

/**
 * Check if string is empty
 */
export const isEmpty = (str: string): boolean =>
    str.length === 0

/**
 * Get string length
 */
export const length = (str: string): number =>
    str.length

/**
 * Pad string on the left
 */
export const padStart = (targetLength: number) => (padString: string) => (str: string): string =>
    str.padStart(targetLength, padString)

/**
 * Pad string on the right
 */
export const padEnd = (targetLength: number) => (padString: string) => (str: string): string =>
    str.padEnd(targetLength, padString)

/**
 * Repeat a string n times
 */
export const repeat = (count: number) => (str: string): string =>
    str.repeat(count)
