/**
 * The GitHub sign-in boundary: declared wire fields and the pending login's
 * state, PKCE verifier, and ten-minute lifetime, plus safe exchange failure
 * reasons. Tokens are browser memory; the pending record exists only while
 * navigating through GitHub.
 *
 * @module
 *
 * @import { ExchangeFailure, Pending } from './types.ts'
 */

import { number, open, or, string } from '../../rtti/module.f.mjs'

/** Public configuration, with no application secret. */
export const configSchema = open({ clientId: string, redirectUri: string })

/** Only the pending authorization survives navigation in sessionStorage. */
export const pendingSchema = /** @type {const} */ ({ state: string, verifier: string, createdAt: number })

/** The browser sends no callback URI or client credentials to the Worker. */
export const exchangeSchema = /** @type {const} */ ({ code: string, verifier: string })

/** Parsing discards extra provider fields, including refresh tokens. */
export const tokenSchema = open({ access_token: string, token_type: 'bearer' })

/** Verify GitHub's returned grants before reducing the browser token shape. */
export const providerTokenSchema = open({ access_token: string, token_type: 'bearer', scope: string })

/** Admit the provider's reason without retaining its raw error description. */
export const providerErrorSchema = open({ error: string })

/** Only fixed local reasons cross the Worker/browser failure boundary. */
export const exchangeFailureSchema = open({ reason: or(
    'incorrect_client_credentials', 'redirect_uri_mismatch', 'bad_verification_code',
    'unverified_user_email', 'provider_error', 'network_error', 'unexpected_scope',
) })

/** Revalidate the signed-in account after each completed authorization. */
export const userSchema = open({ login: string })

/** Allow documented provider reasons; arbitrary provider text stays private. */
/** @type {(error: string) => ExchangeFailure['reason']} */
export const providerErrorReason = error => error === 'incorrect_client_credentials'
    ? 'incorrect_client_credentials'
    : error === 'redirect_uri_mismatch'
        ? 'redirect_uri_mismatch'
        : error === 'bad_verification_code'
            ? 'bad_verification_code'
            : error === 'unverified_user_email'
                ? 'unverified_user_email'
                : 'provider_error'

/** Actionable local messages never interpolate provider fields or credentials. */
/** @type {(reason: ExchangeFailure['reason']) => string} */
export const exchangeFailureMessage = reason => reason === 'incorrect_client_credentials'
    ? "GitHub rejected this site's credentials. Check the GitHub OAuth App configuration."
    : reason === 'redirect_uri_mismatch'
        ? "GitHub rejected this site's callback URL. Check the GitHub OAuth App callback configuration."
        : reason === 'bad_verification_code'
            ? 'GitHub rejected the login code. Please log in again.'
            : reason === 'unverified_user_email'
                ? 'Verify your primary email address on GitHub, then log in again.'
                : reason === 'provider_error'
                    ? 'GitHub returned an unexpected login response. Please try again.'
                    : reason === 'unexpected_scope'
                        ? 'GitHub returned permissions this page does not need. Revoke this app in GitHub’s authorized OAuth apps, then log in again.'
                        : 'Could not reach GitHub. Please try again.'

/** @type {string} */
const unreserved = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'

/** RFC 7636's 43..128 ASCII unreserved characters, without accepting Unicode. */
/** @type {(verifier: string) => boolean} */
export const validVerifier = verifier => verifier.length >= 43
    && verifier.length <= 128
    && [...verifier].every(character => unreserved.includes(character))

/** A matching, single-use authorization whose code has not expired. */
/** @type {(pending: Pending, state: string, now: number) => boolean} */
export const validPending = ({ state: expected, verifier, createdAt }, state, now) => state !== ''
    && state === expected
    && validVerifier(verifier)
    && Number.isFinite(createdAt)
    && Number.isFinite(now)
    && createdAt <= now
    && now - createdAt <= 600_000
