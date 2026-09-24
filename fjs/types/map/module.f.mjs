/**
 * Persistent map operations built on ordered collections.
 *
 * @module
 */

/**
 * @type {<K, V>(map: ReadonlyMap<K, V>, k: K, v: V) => ReadonlyMap<K, V>}
 */
export const mapSet = (map, k, v) => new Map([...map, [k, v]])

/**
 * @type {<K, V>(map: ReadonlyMap<K, V>, k: K) => ReadonlyMap<K, V>}
 */
export const mapDelete = (map, k) => new Map([...map].filter(([xk]) => xk !== k))
