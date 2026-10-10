/** The wire contracts and every pending-login validation branch. */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.mjs'
import { parse } from '../../rtti/parse/module.f.mjs'
import { configSchema, exchangeFailureMessage, exchangeFailureSchema, exchangeSchema, pendingSchema, providerErrorReason, providerErrorSchema, tokenSchema, userSchema, validPending, validVerifier } from './module.f.mjs'

const verifier = 'a'.repeat(43)
const pending = /** @type {const} */ ({ state: 'unguessable', verifier, createdAt: 1_000 })

export const proof = /** @type {const} */ ({
    schemas: () => {
        assertStructurallySame(assertOk(parse(configSchema)({ clientId: 'public', redirectUri: 'https://example.com/prs/', extra: true })),
            { clientId: 'public', redirectUri: 'https://example.com/prs/' })
        assertStructurallySame(assertOk(parse(pendingSchema)(pending)), pending)
        assertStructurallySame(assertOk(parse(exchangeSchema)({ code: 'temporary', verifier })), { code: 'temporary', verifier })
        assertStructurallySame(assertOk(parse(tokenSchema)({ access_token: 'token', token_type: 'bearer', refresh_token: 'excluded' })),
            { access_token: 'token', token_type: 'bearer' })
        assertStructurallySame(assertOk(parse(providerErrorSchema)({ error: 'bad_verification_code', error_description: 'private-provider-detail' })),
            { error: 'bad_verification_code' })
        assertStructurallySame(assertOk(parse(exchangeFailureSchema)({ reason: 'network_error', error_description: 'private-provider-detail' })),
            { reason: 'network_error' })
        assertStructurallySame(assertOk(parse(userSchema)({ login: 'octocat', id: 1 })), { login: 'octocat' })
        assertError(parse(exchangeSchema)({ code: 'temporary', verifier, redirectUri: 'https://untrusted.example/' }))
        assertError(parse(tokenSchema)({ access_token: 'token', token_type: 'different' }))
        assertError(parse(providerErrorSchema)({ error: 42 }))
        assertError(parse(exchangeFailureSchema)({ reason: 'private-provider-detail' }))
        assertError(parse(pendingSchema)({ state: 'unguessable', verifier }))
    },
    providerReasons: () => {
        assertEq(providerErrorReason('incorrect_client_credentials'), 'incorrect_client_credentials')
        assertEq(providerErrorReason('redirect_uri_mismatch'), 'redirect_uri_mismatch')
        assertEq(providerErrorReason('bad_verification_code'), 'bad_verification_code')
        assertEq(providerErrorReason('unverified_user_email'), 'unverified_user_email')
        assertEq(providerErrorReason('private-provider-detail'), 'provider_error')
        assertEq(providerErrorReason('network_error'), 'provider_error')
        assertEq(providerErrorReason(''), 'provider_error')
    },
    exchangeFailureMessages: () => {
        assertEq(exchangeFailureMessage('incorrect_client_credentials'),
            "GitHub rejected this site's credentials. Check the GitHub OAuth App configuration.")
        assertEq(exchangeFailureMessage('redirect_uri_mismatch'),
            "GitHub rejected this site's callback URL. Check the GitHub OAuth App callback configuration.")
        assertEq(exchangeFailureMessage('bad_verification_code'),
            'GitHub rejected the login code. Please log in again.')
        assertEq(exchangeFailureMessage('unverified_user_email'),
            'Verify your primary email address on GitHub, then log in again.')
        assertEq(exchangeFailureMessage('provider_error'),
            'GitHub returned an unexpected login response. Please try again.')
        assertEq(exchangeFailureMessage('network_error'),
            'Could not reach GitHub. Please try again.')
    },
    pkceVerifier: () => {
        assert(validVerifier(verifier))
        assert(validVerifier('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'))
        assert(validVerifier('a'.repeat(128)))
        assertEq(validVerifier('a'.repeat(42)), false)
        assertEq(validVerifier('a'.repeat(129)), false)
        assertEq(validVerifier(`${'a'.repeat(42)}=`), false)
        assertEq(validVerifier(`${'a'.repeat(42)}é`), false)
    },
    pendingAuthorization: () => {
        assert(validPending(pending, 'unguessable', 1_000))
        assert(validPending(pending, 'unguessable', 601_000))
        assertEq(validPending(pending, '', 1_000), false)
        assertEq(validPending(pending, 'mismatch', 1_000), false)
        assertEq(validPending({ ...pending, verifier: 'short' }, 'unguessable', 1_000), false)
        assertEq(validPending({ ...pending, createdAt: NaN }, 'unguessable', 1_000), false)
        assertEq(validPending(pending, 'unguessable', NaN), false)
        assertEq(validPending(pending, 'unguessable', 999), false)
        assertEq(validPending(pending, 'unguessable', 601_001), false)
    },
})
