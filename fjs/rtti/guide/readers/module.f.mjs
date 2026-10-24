/**
 * The lessons of the readers pages, in the order the module page's demo lists
 * them. A page owns its lessons: each sits in the page's `sample.f.mjs`.
 *
 * @module
 *
 * @import { DemoExample } from '../../types.ts'
 */

import { lessons as parseAndValidate } from './parse-and-validate/sample.f.mjs'
import { lessons as errors } from './errors/sample.f.mjs'

/** @type {readonly DemoExample[]} */
export const lessons = [...parseAndValidate, ...errors]
