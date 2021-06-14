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

export function verifyPosRange(a: bigint, n: bigint): true | never {
    if (!(BigInt(0) <= a && a < n)) {
        throw new Error('a not in range')
    }
    return true
}
export function bitLen(n: bigint): number {
    return n.toString(2).length
}
export function byteLen(n: bigint): number {
    return Math.ceil(bitLen(n) / 8)
}
export function isOdd(n: bigint): boolean {
    return n % BigInt(2) === BigInt(1)
}
export function isEven(n: bigint): boolean {
    return n % BigInt(2) === BigInt(0)
}
// Mod a number properly, even when negative
export function posMod(n: bigint, p: bigint): bigint {
    let r = n % p
    if (r < BigInt(0)) {
        r = (r + p) % p
    }
    return r
}
// expMod returns n^e mod p.
export function expMod(n: bigint, e: bigint, p: bigint): bigint {
    if (e < BigInt(0)) {
        throw new Error('neg expo')
    }
    let r = BigInt(1),
        q = n,
        k = e
    while (k > BigInt(0)) {
        if (isOdd(k)) {
            r = (r * q) % p
        }
        q = (q * q) % p
        k = k / BigInt(2)
    }
    return r
}

export function isNonNegative(n: bigint, p: bigint): boolean {
    const pMinus1div2 = (p - BigInt(1)) >> BigInt(1)
    return 0 <= n && n <= pMinus1div2
}
export function absolute(n: bigint, p: bigint): bigint {
    return isNonNegative(n, p) ? n : posMod(-n, p)
}
export function isSquare(n: bigint, p: bigint): boolean {
    const q = (p - BigInt(1)) >> BigInt(1) // q = (p-1)/2
    return expMod(n, q, p) === BigInt(1)
}
export function invSqrtMod(n: bigint, p: bigint): bigint {
    const q = (p + BigInt(1)) >> BigInt(2) // q = (p+1)/4
    return expMod(invEuclid(n, p), q, p)
}
export function invMod(n: bigint, p: bigint): bigint {
    return invEuclid(n, p)
}

function extendedEuclid(X: bigint, Y: bigint): { g: bigint; a: bigint; b: bigint } {
    let a = BigInt(1),
        b = BigInt(0),
        c = BigInt(0),
        d = BigInt(1),
        x = X,
        y = Y,
        t = BigInt(0)
    while (y != BigInt(0)) {
        const q = x / y
        a = a - c * q
        b = b - d * q
        x = x - q * y

        t = x
        x = y
        y = t

        t = a
        a = c
        c = t

        t = b
        b = d
        d = t
    }
    return {
        g: x,
        a: a,
        b: b,
    }
}

export function invEuclid(t: bigint, N: bigint): bigint {
    const res = extendedEuclid(t, N)
    let inv = res.a
    if (inv < 0) {
        inv += N
    }
    return inv
}

export function toBytes(n: bigint, len: number): Uint8Array {
    const maxBig = BigInt(1) << (BigInt(8) * BigInt(len))
    if (!(len > 0 && BigInt(0) <= n && n < maxBig)) {
        throw new Error("number doesn't fit in array")
    }
    const ret = new Uint8Array(len)
    let t = n
    for (let i = 0; i < len; i++) {
        const b = t & BigInt(255)
        ret[len - 1 - i] = parseInt(b.toString())
        t >>= BigInt(8)
    }
    return ret
}

export async function hashNums(nums: bigint[]): Promise<bigint> {
    const numNums = nums.length,
        data = [],
        enc = new TextEncoder()
    let totBytes = 0
    for (let i = 0; i < numNums; i++) {
        const numBytes = enc.encode(nums[i].toString())
        totBytes += numBytes.byteLength
        data.push(numBytes)
    }
    const tbh = new Uint8Array(totBytes + 4 * numNums) // Include space for lengths
    let index = 0
    for (let i = 0; i < numNums; i++) {
        tbh[index++] = (data[i].byteLength >> 24) & 0xff
        tbh[index++] = (data[i].byteLength >> 16) & 0xff
        tbh[index++] = (data[i].byteLength >> 8) & 0xff
        tbh[index++] = data[i].byteLength & 0xff
        tbh.set(data[i], index)
        index += data[i].byteLength
    }
    const hash = await crypto.subtle.digest('SHA-256', tbh)

    return fromBytes(new Uint8Array(hash.slice(0, 10))) // Our challenge is only 80 bits.
}

export function fromBytes(a: Uint8Array): bigint {
    let k = BigInt(0)
    for (const ai of a) {
        k <<= BigInt(8)
        k |= BigInt(ai)
    }
    return k
}

// Generate a random number between [0, n)
export function rnd(n: bigint): bigint {
    const buffer = new Uint8Array(byteLen(n))
    // eslint-disable-next-line no-constant-condition
    while (true) {
        crypto.getRandomValues(buffer)
        const ret = fromBytes(buffer)
        if (ret < n) {
            return ret
        }
    }
}
// Generate random number in [min, max] where min and max are potentially signed.
export function rndRange(min: bigint, max: bigint): bigint {
    return rnd(max - min + BigInt(1)) + min
}

export function isPrime(n: bigint, iterations = 7): boolean {
    if (n === BigInt(2) || n === BigInt(3)) {
        return true
    }
    if (isEven(n) || n < BigInt(2)) {
        return false
    }
    // Write (n - 1) as 2^s * d
    const nminusone = n - BigInt(1)
    let s = 0,
        d = nminusone
    while (isEven(d)) {
        d >>= BigInt(1)
        s++
    }
    let k = iterations
    // eslint-disable-next-line no-labels
    WitnessLoop: do {
        // A base between 2 and n - 2
        const base = rnd(n - BigInt(3)) + BigInt(2)
        let x = expMod(base, d, n)

        if (x === BigInt(1) || x === n - BigInt(1)) {
            continue
        }

        for (let i = s - 1; i >= 0; i--) {
            x = x ** BigInt(2) % n

            if (x === BigInt(1)) {
                return false
            }
            if (x === n - BigInt(1)) {
                // eslint-disable-next-line no-labels
                continue WitnessLoop
            }
        }

        return false
    } while ((k -= 1))

    return true
}

export const serdeBigInt = {
    isRequired: true,
    serializer: function (v: bigint): string {
        let s = '0x'
        if (v < BigInt(0)) {
            v = -v
            s = '-' + s
        }
        return s + v.toString(16)
    },
    deserializer: function (this: any, v: string): bigint {
        if (!v) {
            throw new Error('the field ' + this.key + ' is required')
        }
        if (v.charAt(0) === '-') {
            return -BigInt(v.slice(1))
        }
        return BigInt(v)
    },
}
