const object = require('../../types/object')

/**
 * @template M
 * @typedef {{
 *  readonly at: (moduleId: string) => (moduleMap: M) => ModuleState | undefined
 *  readonly insert: (moduleId: string) => (moduleState: ModuleState) => (moduleMap: M) => M
 * }} ModuleMapInterface
 */

/** 
 * @typedef {|
 *  readonly['ok', Module] | 
 *  readonly['error', ModuleError] | 
 *  readonly['building']
 * } ModuleState 
 */

/**
 * @typedef {{
 *  readonly exports: unknown
 *  readonly requireMap: object.Map<string>
 * }} Module
 */

/** 
 * @typedef {|
 *  'file not found' | 
 *  'compile error' | 
 *  'runtime error' | 
 *  'circular reference'
 * } ModuleError
 */

module.exports = {}
