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

/* eslint no-use-before-define: ['error', { classes: false }] */

import { fromBytes, invMod, posMod, serdeBigInt, toBytes, verifyPosRange } from '../bignum/big.js'
import { jsonMember, jsonObject, toJson } from 'typedjson'

import { Group } from './group.js'

@toJson
export class WeierstrassGroup extends Group {
    readonly _brandWeierstrassGroup = ''
    constructor(
        public readonly name: string,
        public readonly p: bigint, // prime modulus.
        public readonly a: bigint, // the a parameter, fixed to a=-3.
        public readonly b: bigint, // the b parameter.
        public readonly order: bigint, // the order of the group.
        public readonly gen: [bigint, bigint] // generator of the group.
    ) {
        super(name, p, order)
        verifyPosRange(a, p)
        verifyPosRange(b, p)
        verifyPosRange(gen[0], p)
        verifyPosRange(gen[1], p)

        if (posMod(a, p) !== p - BigInt(3)) {
            throw new Error('only supports a=-3')
        }

        const generator = this.generator()
        if (!this.isOnGroup(generator)) {
            throw new Error('generator not on group')
        }
    }
    identity(): WeierstrassPoint {
        return new WeierstrassPoint(this, BigInt(0), BigInt(1), BigInt(0))
    }
    generator(): WeierstrassPoint {
        return new WeierstrassPoint(this, this.gen[0], this.gen[1], BigInt(1))
    }
    isOnGroup(pt: WeierstrassPoint): boolean {
        // E: Y^2*Z = X^3 + a*X*Z^2 + b*Z^3
        const { p, a, b } = this,
            { x, y, z } = pt,
            y2 = (y * y) % p,
            y2z = (y2 * z) % p,
            x3 = (x * x * x) % p,
            ax = (a * x) % p,
            z2 = (z * z) % p,
            axz2 = (ax * z2) % p,
            z3 = (z2 * z) % p,
            bz3 = (b * z3) % p,
            t5 = posMod(y2z - (x3 + axz2 + bz3), p)
        return this.eq(pt.group) && t5 === BigInt(0)
    }
    sizePointBytes(): number {
        return 1 + 2 * this.sizeFieldBytes() // uncompressed points
    }
    deserializePoint(a: Uint8Array): WeierstrassPoint {
        if (a.length === 1 && a[0] === 0) {
            return this.identity()
        } else if (a.length === this.sizePointBytes() && a[0] === 0x04) {
            const coordSize = this.sizeFieldBytes(),
                x = fromBytes(a.slice(1, 1 + coordSize)),
                y = fromBytes(a.slice(1 + coordSize)),
                p = new WeierstrassPoint(this, x, y)
            if (!this.isOnGroup(p)) {
                throw new Error('point not in group')
            }
            return p
        } else {
            throw new Error('error deserializing Point')
        }
    }
}

@jsonObject({
    beforeSerialization: 'toAffine',
    onDeserialized: 'afterJson',
})
@toJson
export class WeierstrassPoint extends Group.Point {
    readonly _brandWeierstrassPoint = ''
    @jsonMember({ constructor: Group, isRequired: true }) readonly group: WeierstrassGroup
    @jsonMember(serdeBigInt) public x: bigint
    @jsonMember(serdeBigInt) public y: bigint
    public z: bigint
    constructor(g: WeierstrassGroup, x: bigint, y: bigint, z?: bigint) {
        super()
        this.group = g
        this.x = x
        this.y = y
        this.z = typeof z !== 'undefined' ? z : BigInt(1)
    }
    toString(): string {
        return Group.Point.toStringCoords([
            { name: 'x', value: this.x },
            { name: 'y', value: this.y },
            { name: 'z', value: this.z },
        ])
    }
    isIdentity(): boolean {
        return this.x === BigInt(0) && this.y !== BigInt(0) && this.z === BigInt(0)
    }
    eq(pt: this): boolean {
        const { group: g0, x: x0, y: y0, z: z0 } = this,
            { group: g1, x: x1, y: y1, z: z1 } = pt,
            x0z1 = (x0 * z1) % g0.p,
            x1z0 = (x1 * z0) % g0.p,
            y0z1 = (y0 * z1) % g0.p,
            y1z0 = (y1 * z0) % g0.p
        return g0.eq(g1) && x0z1 === x1z0 && y0z1 === y1z0
    }
    neg(): this {
        const y = posMod(-this.y, this.group.p)
        return new WeierstrassPoint(this.group, this.x, y, this.z) as this
    }
    dbl(): this {
        const { x, y, z } = this,
            { p, b } = this.group
        let t0, t2, t3, x3, y3, z3
        t0 = (x * x) % p //   1.  t0 = x * x
        const t1 = (y * y) % p //   2.  t1 = y * y
        t2 = (z * z) % p //   3.  t2 = z * z
        t3 = (x * y) % p //   4.  t3 = x * y
        t3 = (t3 + t3) % p // 5.  t3 = t3 + t3
        z3 = (x * z) % p //   6.  z3 = x * z
        z3 = (z3 + z3) % p // 7.  z3 = z3 + z3
        y3 = (b * t2) % p //  8.  y3 = b * t2
        y3 = (BigInt(y3) - z3) % p // 9.  y3 = y3 - z3
        x3 = (y3 + y3) % p // 10. x3 = y3 + y3
        y3 = (x3 + y3) % p // 11. y3 = x3 + y3
        x3 = (t1 - y3) % p // 12. x3 = t1 - y3
        y3 = (t1 + y3) % p // 13. y3 = t1 + y3
        y3 = (BigInt(x3) * y3) % p // 14. y3 = x3 * y3
        x3 = (BigInt(x3) * t3) % p // 15. x3 = x3 * t3
        t3 = (t2 + t2) % p // 16. t3 = t2 + t2
        t2 = (t2 + t3) % p // 17. t2 = t2 + t3
        z3 = (b * z3) % p //  18. z3 = b * z3
        z3 = (BigInt(z3) - t2) % p // 19. z3 = z3 - t2
        z3 = (BigInt(z3) - t0) % p // 20. z3 = z3 - t0
        t3 = (z3 + z3) % p // 21. t3 = z3 + z3
        z3 = (z3 + t3) % p // 22. z3 = z3 + t3
        t3 = (t0 + t0) % p // 23. t3 = t0 + t0
        t0 = (t3 + t0) % p // 24. t0 = t3 + t0
        t0 = (BigInt(t0) - t2) % p // 25. t0 = t0 - t2
        t0 = (BigInt(t0) * z3) % p // 26. t0 = t0 * z3
        y3 = (y3 + t0) % p // 27. y3 = y3 + t0
        t0 = (y * z) % p //   28. t0 = y * z
        t0 = (t0 + t0) % p // 29. t0 = t0 + t0
        z3 = (BigInt(t0) * z3) % p // 30. z3 = t0 * z3
        x3 = (BigInt(x3) - z3) % p // 31. x3 = x3 - z3
        z3 = (t0 * t1) % p // 32. z3 = t0 * t1
        z3 = (z3 + z3) % p // 33. z3 = z3 + z3
        z3 = (z3 + z3) % p // 34. z3 = z3 + z3
        x3 = posMod(x3, p)
        y3 = posMod(y3, p)
        z3 = posMod(z3, p)
        return new WeierstrassPoint(this.group, x3, y3, z3) as this
    }
    add(pt: this): this {
        this.isCompatPoint(pt)
        const { x: x1, y: y1, z: z1 } = this,
            { x: x2, y: y2, z: z2 } = pt,
            { p, b } = this.group
        let t0, t1, t2, t3, t4, x3, y3, z3

        t0 = (x1 * x2) % p // 1.  t0 = x1 * x2
        t1 = (y1 * y2) % p // 2.  t1 = y1 * y2
        t2 = (z1 * z2) % p // 3.  t2 = z1 * z2
        t3 = (x1 + y1) % p // 4.  t3 = x1 + y1
        t4 = (x2 + y2) % p // 5.  t4 = x2 + y2
        t3 = (BigInt(t3) * t4) % p // 6.  t3 = t3 * t4
        t4 = (t0 + t1) % p // 7.  t4 = t0 + t1
        t3 = (BigInt(t3) - t4) % p // 8.  t3 = t3 - t4
        t4 = (y1 + z1) % p // 9.  t4 = y1 + z1
        x3 = (y2 + z2) % p // 10. x3 = y2 + z2
        t4 = (BigInt(t4) * x3) % p // 11. t4 = t4 * x3
        x3 = (t1 + t2) % p // 12. x3 = t1 + t2
        t4 = (BigInt(t4) - x3) % p // 13. t4 = t4 - x3
        x3 = (x1 + z1) % p // 14. x3 = x1 + z1
        y3 = (x2 + z2) % p // 15. y3 = x2 + z2
        x3 = (BigInt(x3) * y3) % p // 16. x3 = x3 * y3
        y3 = (t0 + t2) % p // 17. y3 = t0 + t2
        y3 = (BigInt(x3) - y3) % p // 18. y3 = x3 - y3
        z3 = (b * t2) % p //  19. z3 = b* t2
        x3 = (BigInt(y3) - z3) % p // 20. x3 = y3 - z3
        z3 = (x3 + x3) % p // 21. z3 = x3 + x3
        x3 = (x3 + z3) % p // 22. x3 = x3 + z3
        z3 = (BigInt(t1) - x3) % p // 23. z3 = t1 - x3
        x3 = (t1 + x3) % p // 24. x3 = t1 + x3
        y3 = (b * y3) % p //  25. y3 = b* y3
        t1 = (t2 + t2) % p // 26. t1 = t2 + t2
        t2 = (t1 + t2) % p // 27. t2 = t1 + t2
        y3 = (BigInt(y3) - t2) % p // 28. y3 = y3 - t2
        y3 = (BigInt(y3) - t0) % p // 29. y3 = y3 - t0
        t1 = (y3 + y3) % p // 30. t1 = y3 + y3
        y3 = (t1 + y3) % p // 31. y3 = t1 + y3
        t1 = (t0 + t0) % p // 32. t1 = t0 + t0
        t0 = (t1 + t0) % p // 33. t0 = t1 + t0
        t0 = (BigInt(t0) - t2) % p // 34. t0 = t0 - t2
        t1 = (BigInt(t4) * y3) % p // 35. t1 = t4 * y3
        t2 = (BigInt(t0) * y3) % p // 36. t2 = t0 * y3
        y3 = (BigInt(x3) * z3) % p // 37. y3 = x3 * z3
        y3 = (y3 + t2) % p // 38. y3 = y3 + t2
        x3 = (BigInt(t3) * x3) % p // 39. x3 = t3 * x3
        x3 = (BigInt(x3) - t1) % p // 40. x3 = x3 - t1
        z3 = (BigInt(t4) * z3) % p // 41. z3 = t4 * z3
        t1 = (BigInt(t3) * t0) % p // 42. t1 = t3 * t0
        z3 = (z3 + t1) % p // 43. z3 = z3 + t1
        x3 = posMod(x3, p)
        y3 = posMod(y3, p)
        z3 = posMod(z3, p)
        return new WeierstrassPoint(this.group, x3, y3, z3) as this
    }
    toAffine(): { x: bigint; y: bigint } | false {
        if (this.isIdentity()) {
            this.y = BigInt(1)
            return false
        }
        const zInv = invMod(this.z, this.group.p),
            x = posMod(this.x * zInv, this.group.p),
            y = posMod(this.y * zInv, this.group.p)
        this.x = x
        this.y = y
        this.z = BigInt(1)
        return { x, y }
    }
    toBytes(): Uint8Array {
        const coord = this.toAffine()
        if (!coord) {
            return new Uint8Array(1)
        }
        const coordSize = this.group.sizeFieldBytes(),
            ret = new Uint8Array(this.group.sizePointBytes())
        ret[0] = 0x04
        ret.set(toBytes(coord.x, coordSize), 1)
        ret.set(toBytes(coord.y, coordSize), 1 + coordSize)
        return ret
    }
    protected afterJson(): void {
        if (!this.group.isOnGroup(this)) {
            throw new Error(`point not on Weierstrass group: ${this.group.name}`)
        }
    }
}

jsonObject({ knownTypes: [WeierstrassGroup] })(Group)
jsonObject({ knownTypes: [WeierstrassPoint] })(Group.Point)
