/**
 * Types for the repository's `config` file.
 *
 * @module
 */

/**
 * One `key = value` line as it sits in its section: the section's name,
 * lowercased with a subsection as written after a dot, the key
 * lowercased, and the value as text.
 */
export type Entry = readonly [section: string, key: string, value: string]
