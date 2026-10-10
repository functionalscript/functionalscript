/** The wire contracts and every pending-login validation branch. */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.mjs'
import { parse } from '../../rtti/parse/module.f.mjs'
import { configSchema, exchangeSchema, pendingSchema, tokenSchema, userSchema, validPending, validVerifier } from './module.f.mjs'

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
        assertStructurallySame(assertOk(parse(userSchema)({ login: 'octocat', id: 1 })), { login: 'octocat' })
        assertError(parse(exchangeSchema)({ code: 'temporary', verifier, redirectUri: 'https://untrusted.example/' }))
        assertError(parse(tokenSchema)({ access_token: 'token', token_type: 'different' }))
        assertError(parse(pendingSchema)({ state: 'unguessable', verifier }))
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
