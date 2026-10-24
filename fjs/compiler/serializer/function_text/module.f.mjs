/**
 * Compatibility entry for an admitted graph function's canonical code text.
 * Conversion and preparation are shared with every other output consumer.
 *
 * @module
 * @import { Analysis } from '../../../edag/analysis/types.ts'
 */

import { functionFromAnalysis } from '../../../edag/to_fast/module.f.mjs'
import { prepareFunction } from '../../../js/ast/prepare/module.f.mjs'
import { functionStringify } from '../../../js/ast/serializer/module.f.mjs'

export { _entryText, _entryChunks, _hasEntryText, _hasEntryChunks, _intrinsicText, _intrinsicChunks } from '../../../js/ast/serializer/intrinsic/module.f.mjs'

/** Render one already admitted function from its identity table. @type {(a: Analysis, i: number) => string} */
export const renderFunction = (a, i) => functionStringify(prepareFunction(functionFromAnalysis(a, i)))
