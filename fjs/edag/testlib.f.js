/**
 * Test-only canonical conditional fixtures for source logical behavior.
 * These constructors build current EDAG; they accept no legacy graph and are
 * not an admission adapter. Source lowering belongs to AST-to-FAST sugar.
 *
 * @module
 * @import { Exp, Op3 } from './types.ts'
 */

/**
 * Reuse the exact left operand object in every test and retained-value read.
 * Memo execution therefore establishes an identity-bearing left value once.
 * @type {(tag: '&&' | '||' | '??', left: Exp, right: Exp) => Op3}
 */
export const conditional = (tag, left, right) => tag === '&&'
    ? ['?:', left, right, left]
    : tag === '||'
        ? ['?:', left, left, right]
        : ['?:', ['?:', ['===', left, null], true, ['===', left, ['undefined']]], right, left]
