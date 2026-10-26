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

import {
    _entryText as intrinsicEntryText, _entryChunks as intrinsicEntryChunks,
    _hasEntryText as intrinsicHasEntryText, _hasEntryChunks as intrinsicHasEntryChunks,
    _intrinsicText as intrinsicIntrinsicText, _intrinsicChunks as intrinsicIntrinsicChunks,
} from '../../../js/ast/serializer/intrinsic/module.f.mjs'

export const _entryText = intrinsicEntryText
export const _entryChunks = intrinsicEntryChunks
export const _hasEntryText = intrinsicHasEntryText
export const _hasEntryChunks = intrinsicHasEntryChunks
export const _intrinsicText = intrinsicIntrinsicText
export const _intrinsicChunks = intrinsicIntrinsicChunks

/** Render one already admitted function from its identity table. @type {(a: Analysis, i: number) => string} */
export const renderFunction = (a, i) => functionStringify(prepareFunction(functionFromAnalysis(a, i)))
