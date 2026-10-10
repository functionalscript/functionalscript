/**
 * Declared GitHub sign-in data and the Cloudflare host bindings. Application
 * credentials are Worker bindings and never browser configuration.
 *
 * @module
 */

import type { Ts } from '../../rtti/ts/types.ts'
import type { configSchema, exchangeSchema, pendingSchema, tokenSchema, userSchema } from './module.f.mjs'

/** Public application ID and registered callback. */
export type Config = Ts<typeof configSchema>

/** One pending authorization, held in tab-local sessionStorage. */
export type Pending = Ts<typeof pendingSchema>

/** A temporary authorization code and its original PKCE verifier. */
export type Exchange = Ts<typeof exchangeSchema>

/** The bearer token held only in browser memory. */
export type Token = Ts<typeof tokenSchema>

/** The identity verified directly with GitHub. */
export type User = Ts<typeof userSchema>

/** Cloudflare configuration and the optional static-assets binding. */
export type WorkerEnv = {
    readonly GITHUB_CLIENT_ID?: string
    readonly GITHUB_CLIENT_SECRET?: string
    readonly GITHUB_REDIRECT_URI?: string
    readonly ASSETS?: { readonly fetch: (request: Request) => Promise<Response> }
}

/** The network boundary supplied by the Worker host or its proof. */
export type WorkerHost = { readonly fetch?: typeof fetch }

/** The process boundary for uploading a preview with runtime bindings. */
export type PreviewUploadHost = {
    readonly run?: (args: readonly string[]) => Promise<number>
}
