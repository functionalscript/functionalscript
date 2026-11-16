/**
 * The schemas the project uses, in the order the module page's demo lists
 * them. A page owns its schemas: each sits in the page's `sample.f.js`.
 *
 * @module
 *
 * @import { DemoExample } from '../../types.ts'
 */

import { lessons as protocols } from './protocols/sample.f.js'
import { lessons as media } from './media/sample.f.js'
import { lessons as tooling } from './tooling/sample.f.js'
import { lessons as expressionGraph } from './expression-graph/sample.f.js'
import { lessons as effects } from './effects/sample.f.js'

/** @type {readonly DemoExample[]} */
export const lessons = [...protocols, ...media, ...tooling, ...expressionGraph, ...effects]
