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

import { invEuclid, isPrime } from '../../src/bignum/big.js'

export function testInvEuclid(): boolean {
    return 2n == invEuclid(3n, 5n) && 6n === invEuclid(7n, 41n)
}

export function testPrimality(): boolean {
    if (!isPrime(23n)) {
        console.log('23')
        return false
    }
    if (isPrime(221n)) {
        console.log('221')
        return false
    }
    if (!isPrime(257n)) {
        console.log('257')
        return false
    }
    if (isPrime(477n)) {
        console.log('477')
        return false
    }
    if (!isPrime(BigInt('0xffffffff0000000100000000000000017e72b42b30e7317793135661b1c4b117'))) {
        console.log('first big')
        return false
    }
    if (!isPrime(BigInt('0x115792089210356248762697446949407573530086143415290314195533631308867097853951'))) {
        console.log('second big')
        return false
    }
    return true
}
