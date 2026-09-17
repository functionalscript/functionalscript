/**
 * Type-level API of the FunctionalScript writer.
 *
 * @module
 */

import type { List } from '../../types/list/types.ts'
import type { Result } from '../../types/result/types.ts'

/** A document, or why the writer has no spelling for the graph. */
export type Document = Result<List<string>, string>
