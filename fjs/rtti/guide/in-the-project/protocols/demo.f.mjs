/**
 * The page's demo: [`README.md`](./README.md)'s schemas in the rtti demo,
 * each drawn as a graph with what rtti derives from it, and a value the
 * reader can change, with what `parse` and `validate` make of it.
 *
 * @module
 */

import { schemaDemo } from '../../../schema-demo/module.f.mjs'
import { lessons } from './sample.f.mjs'

export const demo = schemaDemo([['Protocols', lessons]])
