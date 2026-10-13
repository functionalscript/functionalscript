/**
 * Node's events are the events `quiet` reads. The check lives here, outside
 * the shipped declarations, because it names `node:test/reporters`, which a
 * consumer without `@types/node` cannot resolve; a type error here means
 * `types.ts` has drifted from the Node the repository pins.
 *
 * @module
 */

import type { TestEvent } from 'node:test/reporters'
import type { Assert } from '../../asserts/types.ts'
import type { Event } from './types.ts'

export type _NodeEventIsAnEvent = Assert<TestEvent extends Event ? true : false>
