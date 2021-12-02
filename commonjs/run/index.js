const result = require('../../result')

/** @typedef {(req: Require) => ModuleResult} Module*/

/** @typedef {readonly[result.Result<unknown, unknown>, Require]} ModuleResult */

/** @typedef {(path: string) => ModuleResult} Require */

/** @typedef {(source: string) => result.Result<Module, unknown>} Compile */

module.exports = {}