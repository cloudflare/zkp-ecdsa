/**
 * Copyright 2021 Cloudflare Inc
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { invMod, posMod } from '../bignum/big.js'

function eval_poly(coeff: bigint[], x: bigint, m: bigint): bigint {
    let ret = BigInt(0)
    for (let i = coeff.length - 1; i >= 0; i--) {
        ret = posMod(coeff[i] + x * ret, m)
    }
    return ret
}

export function interpolate(x: bigint[], y: bigint[], m: bigint): bigint[] {
    if (x.length != y.length) {
        throw new Error('inconsistent args')
    }
    const n = x.length,
        s = [],
        coeff = []
    for (let i = 0; i < n; i++) {
        s[i] = BigInt(0)
        coeff[i] = BigInt(0)
    }

    // Compute s(x)= \Pi (x-xi)
    s[n] = BigInt(1) // Leading term
    s[n - 1] = -x[0] % m
    for (let i = 1; i < n; i++) {
        for (let j = n - i - 1; j < n - 1; j++) {
            s[j] = (s[j] - x[i] * s[j + 1]) % m
        }
        s[n - 1] = (s[n - 1] - x[i]) % m
    }
    for (let i = 0; i < n; i++) {
        // compute \Pi (x_i-x_j) by evaluating the derivative of s at x_i
        let phi = BigInt(0)
        for (let j = n; j >= 1; j--) {
            phi = BigInt(j) * s[j] + x[i] * phi
        }
        phi = posMod(phi, m)
        const ff = invMod(phi, m) % m

        let b = BigInt(1)
        for (let j = n - 1; j >= 0; j--) {
            coeff[j] = posMod(coeff[j] + b * ff * y[i], m)
            b = s[j] + x[i] * b
        }
    }
    for (let i = 0; i < n; i++) {
        if (y[i] != eval_poly(coeff, x[i as number], m)) {
            throw new Error('incorrect interpolation')
        }
    }

    return coeff
}
