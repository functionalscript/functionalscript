/**
 * JavaScript runtime compilation for EDAG values. The generated module exports
 * a factory: imports may reuse its code, while every invocation constructs a
 * fresh value graph. Ordinary runtime values retain no EDAG reflection.
 *
 * @module
 * @import { ToAsyncOperationMap } from '../../../effects/types.ts'
 * @import { CompileValue } from './types.ts'
 */

import { Buffer } from 'node:buffer'

import { toIoError } from '../../../effects/module.f.mjs'
import { error, ok } from '../../../types/result/module.f.mjs'

/** JavaScript loader for the explicit runtime-compilation effect. @type {ToAsyncOperationMap<CompileValue>} */
export const javascriptOperationMap = {
    compileValue: async source => {
        try {
            const encoded = Buffer.from(source).toString('base64')
            const module = await import(`data:text/javascript;base64,${encoded}`)
            // Wrap before returning through a Promise: a runtime object's
            // ordinary `then` field must never become Promise assimilation.
            return ok(module.default())
        } catch (e) {
            return error(toIoError(e))
        }
    },
}
