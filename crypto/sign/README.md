# Digital Signature

We use elliptic curves for digital signatures.

`z` is a hash of a message.

`k` is a unique for each `z` and secret.

`R = G * k`.

`r = R.x`.

`s = ((z + r * d) / k)`.

The signature is `(r, s)`.

## Verifying a signature

`w = 1/s`

`u1 = z * w` and `u2 = r * w`

`X = G * u1 + Q * u2`

`v = X.x`

The signature is valid if `v = r`

## Proof

`X = G * (z * 1/s) + Q * (r * 1/s)`
`X = G * z * 1/s + G * d * r * 1/s`
`G * z * 1/s + d * r * 1/s = G * k`
`z * 1/s + d * r * 1/s) = k`
`z + d * r = k * s`
`z + d * r = k * (z + r * d) / k`
`z + d * r = z + r * d`

## Selecting `k`

`k` should depend on both `z` (the hash of the message) and `d` (the private key).

See [RFC6979](https://www.rfc-editor.org/rfc/rfc6979)

`V = 0x01`, `K = 0x00`.

Next

`K = HMAC(K, V || 0x00 || d || h)`
`V = HMAC(K, V)`
`K = HMAC(K, V || 0x01 || d || h)`
`V = HMAC(K, V)`

Next

`k = HMAC(K, V)`
