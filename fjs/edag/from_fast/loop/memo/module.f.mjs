/** Compatibility exports for shared FAST demand normalization. @module */

import { normalizeMemo as sharedNormalizeMemo, normalizeLazyReturns as sharedNormalizeLazyReturns } from '../../../../js/ast/memo/module.f.mjs'

/** @type {typeof sharedNormalizeMemo} */
export const normalizeMemo = sharedNormalizeMemo
/** @type {typeof sharedNormalizeLazyReturns} */
export const normalizeLazyReturns = sharedNormalizeLazyReturns
