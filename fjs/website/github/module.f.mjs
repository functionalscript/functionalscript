/**
 * The GitHub sign-in boundary: declared wire fields and the pending login's
 * state, PKCE verifier, and ten-minute lifetime, plus safe exchange failure
 * reasons. Tokens are browser memory; the pending record exists only while
 * navigating through GitHub.
 *
 * @module
 *
 * @import { AuthorizeParams, CallbackOrigin, CallbackUrl, Config, ConfigDiagnostics, Exchange, ExchangeFailure, Pending, ProviderOutcome, WorkerConfig, WorkerEnv } from './types.ts'
 * @import { Unknown } from '../../rtti/ts/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 */

import { number, open, or, string } from '../../rtti/module.f.mjs'
import { parse } from '../../rtti/parse/module.f.mjs'
import { error, ok } from '../../types/result/module.f.js'

/**
 * The prefix of the Worker's routes: a path under it that is neither route
 * is the Worker's 404, not an asset.
 */
export const authPrefix = /** @type {const} */ ('/auth/github/')

/**
 * The public-configuration route, one of the Worker's two. The Worker that
 * serves them and the page that calls them both import
 * these, so the two hosts agree on them by construction.
 */
export const configPath = /** @type {const} */ (`${authPrefix}config`)

/** The code-exchange route, beside {@link configPath}. */
export const tokenPath = /** @type {const} */ (`${authPrefix}token`)

/**
 * The page GitHub redirects back to: the one callback path the Worker
 * admits in its configuration and the page accepts as its redirect.
 */
export const callbackPath = /** @type {const} */ ('/prs/')

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

/** @type {string} */
const dnsLabelCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789-'

/** One normalized DNS label, including the Workers account and preview names. */
/** @type {(label: string) => boolean} */
const validDnsLabel = label => label.length > 0 && label.length <= 63
    && !label.startsWith('-') && !label.endsWith('-')
    && [...label].every(character => dnsLabelCharacters.includes(character))

/**
 * Preserve exact callbacks; an HTTPS Workers account callback also admits its
 * single-label deployments. Other registered hosts never gain subdomains.
 */
/** @type {(requested: CallbackOrigin, registered: CallbackOrigin) => boolean} */
export const allowedCallbackOrigin = ({ protocol, hostname, port }, registered) => {
    if (protocol !== registered.protocol || port !== registered.port) { return false }
    if (hostname === registered.hostname) { return true }
    if (protocol !== 'https:' || !registered.hostname.endsWith('.workers.dev')
        || !hostname.endsWith(`.${registered.hostname}`)) { return false }
    const account = registered.hostname.slice(0, -'.workers.dev'.length)
    const preview = hostname.slice(0, -registered.hostname.length - 1)
    return validDnsLabel(account) && validDnsLabel(preview)
}

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

/** The hosts a callback may name over plain `http:`: this machine only. */
const loopbackHosts = /** @type {const} */ (['localhost', '127.0.0.1', '[::1]'])

/**
 * A registered callback the Worker accepts: `https:`, or `http:` on a loopback
 * host, whose path is exactly {@link callbackPath}, with no query, fragment or
 * credentials. Parsing the URL stays in the host.
 *
 * @type {(url: CallbackUrl) => boolean}
 */
export const validCallback = ({ protocol, hostname, pathname, search, hash, username, password }) =>
    (protocol === 'https:' || (protocol === 'http:' && loopbackHosts.some(host => host === hostname)))
    && pathname === callbackPath && search === '' && hash === '' && username === '' && password === ''

/** The bindings a configured Worker needs, named in its 503 body. */
const bindingNames = /** @type {const} */ (['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_REDIRECT_URI'])

/** @type {(value: string | undefined) => boolean} */
const present = value => value !== undefined && value !== ''

/**
 * The Worker's credentials when its bindings configure sign-in, or what is
 * wrong with them: the 503 body. `redirect` and `preview` say whether each
 * callback binding passed {@link validCallback}; an absent preview binding is
 * no fault.
 *
 * @type {(env: WorkerEnv, admitted: { readonly redirect: boolean, readonly preview: boolean }) => Result<WorkerConfig, ConfigDiagnostics>}
 */
export const workerConfig = (env, { redirect, preview }) => {
    const { GITHUB_CLIENT_ID: clientId, GITHUB_CLIENT_SECRET: clientSecret } = env
    const previewConfigured = present(env.GITHUB_PREVIEW_REDIRECT_URI)
    if (redirect && clientId !== undefined && clientId !== '' && clientSecret !== undefined && clientSecret !== ''
        && (!previewConfigured || preview)) {
        return ok({ clientId, clientSecret })
    }
    return error({
        error: 'GitHub login is not configured.',
        missingBindings: bindingNames.filter(name => !present(env[name])),
        invalidRedirectUri: present(env.GITHUB_REDIRECT_URI) && !redirect,
        ...(previewConfigured ? { invalidPreviewRedirectUri: !preview } : {}),
    })
}

/**
 * An exchange request within GitHub's limits: a non-empty code of at most
 * 1,024 characters and a {@link validVerifier}.
 *
 * @type {(exchange: Exchange) => boolean}
 */
export const validExchange = ({ code, verifier }) => code.length > 0 && code.length <= 1_024 && validVerifier(verifier)

const readProviderToken = parse(providerTokenSchema)
const readProviderError = parse(providerErrorSchema)

/**
 * GitHub's answer to the token exchange, by its status and parsed body: the
 * token, or the fixed reason and the status the Worker answers with. A
 * redirect is never followed, a provider error keeps only a documented
 * reason, and a token that carries any scope is refused, since the page asks
 * for none.
 *
 * @type {(status: number, body: Unknown) => ProviderOutcome}
 */
export const providerOutcome = (status, body) => {
    if (status >= 300 && status < 400) { return error(['provider_error', 502]) }
    const failureStatus = status >= 500 ? 502 : 400
    const [errorTag, providerError] = readProviderError(body)
    if (errorTag === 'ok') { return error([providerErrorReason(providerError.error), failureStatus]) }
    if (status < 200 || status >= 300) { return error(['provider_error', failureStatus]) }
    const [tokenTag, token] = readProviderToken(body)
    if (tokenTag === 'error' || token.access_token === '') { return error(['provider_error', 400]) }
    if (token.scope !== '') { return error(['unexpected_scope', 400]) }
    return ok({ access_token: token.access_token, token_type: token.token_type })
}

/**
 * The query parameters an OAuth callback can carry. Any of the first three
 * makes the page a callback; all five are scrubbed from the address before
 * anything else runs, since `code` and `state` are credentials.
 */
export const callbackParams = /** @type {const} */ (['code', 'state', 'error', 'error_description', 'error_uri'])

/**
 * Whether a page whose query names `names` is GitHub's callback: it carries
 * a `code`, a `state` or an `error`.
 *
 * @type {(names: readonly string[]) => boolean}
 */
export const isCallback = names => names.some(name => name === 'code' || name === 'state' || name === 'error')

/**
 * Whether the public configuration serves this page: a client ID, and a
 * registered redirect, as the host's URL parser normalized it, that is
 * {@link callbackPath} on `origin`.
 *
 * @type {(config: Config, origin: string) => boolean}
 */
export const redirectMatches = ({ clientId, redirectUri }, origin) =>
    clientId !== '' && redirectUri === `${origin}${callbackPath}`

/** GitHub's authorization endpoint, which the page navigates to. */
export const authorizeEndpoint = /** @type {const} */ ('https://github.com/login/oauth/authorize')

/**
 * The query of the {@link authorizeEndpoint} navigation: this site's client
 * and callback, a fresh account choice, the `state` and the S256 PKCE
 * `challenge`. No scope is asked for.
 *
 * @type {(config: Config, state: string, challenge: string) => AuthorizeParams}
 */
export const authorizeParams = ({ clientId, redirectUri }, state, challenge) => ({
    client_id: clientId,
    redirect_uri: redirectUri,
    prompt: 'select_account',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
})

/**
 * The record kept in sessionStorage across the navigation to GitHub and
 * back, as {@link pendingSchema} reads it.
 *
 * @type {(state: string, verifier: string, createdAt: number) => Pending}
 */
export const pending = (state, verifier, createdAt) => ({ state, verifier, createdAt })

/**
 * The authorization code a callback carries, or `null` where it does not
 * complete the pending login: exactly one non-empty `code`, exactly one
 * `state`, and a {@link validPending} record for it.
 *
 * @type {(codes: readonly string[], states: readonly string[], record: Pending, now: number) => Nullable<string>}
 */
export const callbackCode = (codes, states, record, now) =>
    codes.length === 1 && codes[0] !== '' && states.length === 1 && validPending(record, states[0], now) ? codes[0] : null

/**
 * Everything the login says on the page. None interpolates provider text or
 * a credential; {@link withStatus} adds the one number a failure may carry.
 */
export const loginMessages = /** @type {const} */ ({
    notLoggedIn: 'Not logged in to GitHub.',
    loggedOut: 'Logged out. Refresh to read public GitHub results.',
    unavailable: 'GitHub login is unavailable on this site.',
    ready: 'Log in to use your GitHub API rate limit.',
    opening: 'Opening GitHub login…',
    openFailed: 'Could not open GitHub login. Allow browser session storage and try again.',
    unverified: 'GitHub login details could not be verified. Please log in again.',
    denied: 'GitHub login was cancelled or denied. You can try again.',
    expired: 'GitHub login expired or could not be verified. Please log in again.',
    completing: 'Completing GitHub login…',
    exchangeFailed: 'Could not exchange the GitHub login code. Please try again.',
    accountFailed: 'Could not verify your GitHub account. Please try again.',
    loggedInAs: 'Logged in as',
    lifetime: 'Login lasts until you reload or leave this page.',
})

/**
 * A failure message with the HTTP status of the response that caused it.
 *
 * @type {(message: string, status: number) => string}
 */
export const withStatus = (message, status) => `${message} (HTTP ${status})`
