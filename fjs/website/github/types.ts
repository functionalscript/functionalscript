/**
 * Declared GitHub sign-in data and the Cloudflare host bindings. Application
 * credentials are Worker bindings and never browser configuration.
 *
 * @module
 */

import type { Ts } from '../../rtti/ts/types.ts'
import type { Result } from '../../types/result/types.ts'
import type { configSchema, exchangeFailureSchema, exchangeSchema, pendingSchema, tokenSchema, userSchema } from './module.f.mjs'

/** Public application ID and registered callback. */
export type Config = Ts<typeof configSchema>

/** Normalized URL components supplied by the host's URL parser. */
export type CallbackOrigin = {
    readonly protocol: string
    readonly hostname: string
    readonly port: string
}

/** The parsed callback URL's components `validCallback` reads. */
export type CallbackUrl = {
    readonly protocol: string
    readonly hostname: string
    readonly pathname: string
    readonly search: string
    readonly hash: string
    readonly username: string
    readonly password: string
}

/** The Worker's 503 body when its bindings do not configure sign-in. */
export type ConfigDiagnostics = {
    readonly error: string
    readonly missingBindings: readonly string[]
    readonly invalidRedirectUri: boolean
    readonly invalidPreviewRedirectUri?: boolean
}

/** The client credentials of a Worker whose bindings configure sign-in. */
export type WorkerConfig = {
    readonly clientId: string
    readonly clientSecret: string
}

/** The query of the navigation to GitHub's authorization endpoint. */
export type AuthorizeParams = {
    readonly client_id: string
    readonly redirect_uri: string
    readonly prompt: 'select_account'
    readonly state: string
    readonly code_challenge: string
    readonly code_challenge_method: 'S256'
}

/** One pending authorization, held in tab-local sessionStorage. */
export type Pending = Ts<typeof pendingSchema>

/** A temporary authorization code and its original PKCE verifier. */
export type Exchange = Ts<typeof exchangeSchema>

/** A fixed local exchange reason, without credentials or provider details. */
export type ExchangeFailure = Ts<typeof exchangeFailureSchema>

/** The bearer token held only in browser memory. */
export type Token = Ts<typeof tokenSchema>

/** GitHub's exchange answer: the token, or the reason and status to answer with. */
export type ProviderOutcome = Result<Token, readonly [ExchangeFailure['reason'], number]>

/** The identity verified directly with GitHub. */
export type User = Ts<typeof userSchema>

/** Cloudflare configuration and the optional static-assets binding. */
export type WorkerEnv = {
    readonly GITHUB_CLIENT_ID?: string
    readonly GITHUB_CLIENT_SECRET?: string
    readonly GITHUB_REDIRECT_URI?: string
    readonly GITHUB_PREVIEW_REDIRECT_URI?: string
    readonly ASSETS?: { readonly fetch: (request: Request) => Promise<Response> }
}

/** The network boundary supplied by the Worker host or its proof. */
export type WorkerHost = { readonly fetch?: typeof fetch }

/** The process boundary for uploading a preview with runtime bindings. */
export type PreviewUploadHost = {
    readonly run?: (args: readonly string[]) => Promise<number>
}
