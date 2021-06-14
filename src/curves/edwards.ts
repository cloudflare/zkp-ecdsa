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
export class TEdwards extends Group {
    readonly _brandTEdwards = ''
    constructor(
        public readonly name: string,
        public readonly p: bigint, // prime modulus.
        public readonly a: bigint, // the a parameter.
        public readonly d: bigint, // the d parameter.
        public readonly order: bigint, // the order of the group.
        public readonly gen: [bigint, bigint] // generator of the group.
    ) {
        super(name, p, order)
        verifyPosRange(a, p)
        verifyPosRange(d, p)
        verifyPosRange(gen[0], p)
        verifyPosRange(gen[1], p)

        const generator = this.generator()
        if (!this.isOnGroup(generator)) {
            throw new Error('generator not on group')
        }
    }
    identity(): TEdwardsPoint {
        return new TEdwardsPoint(this, BigInt(0), BigInt(1))
    }
    generator(): TEdwardsPoint {
        return new TEdwardsPoint(this, this.gen[0], this.gen[1], posMod(this.gen[0] * this.gen[1], this.p), BigInt(1))
    }
    isOnGroup(pt: TEdwardsPoint): boolean {
        // E: (a*X^2 + Y^2 = Z^2 + d*T^2) and (X*Y = Z*T)
        const { p, a, d } = this,
            { x, y, t, z } = pt,
            x2 = (x * x) % p,
            y2 = (y * y) % p,
            t2 = (t * t) % p,
            z2 = (z * z) % p,
            l0 = (a * x2 + y2) % p,
            r0 = (z2 + d * t2) % p,
            l1 = (x * y) % p,
            r1 = (z * t) % p
        return this.eq(pt.group) && posMod(l0 - r0, p) === BigInt(0) && posMod(l1 - r1, p) === BigInt(0)
    }
    sizePointBytes(): number {
        return 1 + 2 * this.sizeFieldBytes() // uncompressed points
    }
    // Format: (0x04 || x || y ) using 33 bytes per coordinate in big-endian.
    deserializePoint(bytes: Uint8Array): TEdwardsPoint {
        if (bytes.length === this.sizePointBytes() && bytes[0] === 0x04) {
            const coordSize = this.sizeFieldBytes(),
                x = fromBytes(bytes.slice(1, 1 + coordSize)),
                y = fromBytes(bytes.slice(1 + coordSize))
            verifyPosRange(x, this.p)
            verifyPosRange(y, this.p)
            const t = posMod(x * y, this.p),
                point = new TEdwardsPoint(this, x, y, t, BigInt(1))
            if (!this.isOnGroup(point)) {
                throw new Error(`point not on TEdwards group: ${this.name} `)
            }
            return point
        } else {
            throw new Error('error deserializing TEdwardsPoint')
        }
    }
}

@jsonObject({
    beforeSerialization: 'toAffine',
    onDeserialized: 'afterJson',
})
@toJson
export class TEdwardsPoint extends Group.Point {
    readonly _brandTEdwardsPoint = ''
    @jsonMember({ constructor: Group, isRequired: true }) readonly group: TEdwards
    @jsonMember(serdeBigInt) public x: bigint
    @jsonMember(serdeBigInt) public y: bigint
    public z: bigint
    public t: bigint
    constructor(g: TEdwards, x: bigint, y: bigint, t?: bigint, z?: bigint) {
        super()
        this.group = g
        this.x = x
        this.y = y
        this.t = typeof t !== 'undefined' ? t : x * y
        this.z = typeof z !== 'undefined' ? z : BigInt(1)
    }
    toString(): string {
        return Group.Point.toStringCoords([
            { name: 'x', value: this.x },
            { name: 'y', value: this.y },
            { name: 't', value: this.t },
            { name: 'z', value: this.z },
        ])
    }
    isIdentity(): boolean {
        return (
            this.x === BigInt(0) &&
            this.y !== BigInt(0) &&
            this.t === BigInt(0) &&
            this.z !== BigInt(0) &&
            this.y === this.z
        )
    }
    eq(pt: TEdwardsPoint): boolean {
        // Verify that: (X0 * Z1 = X1 * Z0) and (Y0 * Z1 = Y1 * Z0).
        const { group: g0, x: x0, y: y0, z: z0 } = this,
            { group: g1, x: x1, y: y1, z: z1 } = pt,
            x0z1 = posMod(x0 * z1, g0.p),
            x1z0 = posMod(x1 * z0, g0.p),
            y0z1 = posMod(y0 * z1, g0.p),
            y1z0 = posMod(y1 * z0, g0.p)
        return g0.eq(g1) && x0z1 === x1z0 && y0z1 === y1z0
    }
    neg(): this {
        const x = posMod(-this.x, this.group.p),
            t = posMod(-this.t, this.group.p)
        return new TEdwardsPoint(this.group, x, this.y, t, this.z) as this
    }
    dbl(): this {
        // Section 3.3 from "Twisted Edwards Curves Revisited" by Hisil et al.
        const { x, y, z } = this,
            { p, a } = this.group,
            A = (x * x) % p, //   A  = X1^2
            B = (y * y) % p, //   B  = Y1^2
            CC = z * z, //        CC = Z1^2
            C = (CC + CC) % p, // C  = 2*Z1^2
            D = (a * A) % p, //   D  = a*A
            EE = x + y,
            E = (EE * EE - A - B) % p, // E  = (X1 + Y1)^2 - A - B
            G = (D + B) % p, //       G  = D + B
            F = (G - C) % p, //       F  = G - C
            H = (D - B) % p, //       H  = D - B
            x3 = posMod(E * F, p), // X3 = E * F
            y3 = posMod(G * H, p), // Y3 = G * H
            t3 = posMod(E * H, p), // T3 = E * H
            z3 = posMod(F * G, p) //  Z3 = F * G
        return new TEdwardsPoint(this.group, x3, y3, t3, z3) as this
    }
    add(pt: this): this {
        // Section 3.1 from "Twisted Edwards Curves Revisited" by Hisil et al.
        this.isCompatPoint(pt)
        const { x: x1, y: y1, t: t1, z: z1 } = this,
            { x: x2, y: y2, t: t2, z: z2 } = pt,
            { p, a, d } = this.group,
            A = (x1 * x2) % p, // A = X1 * X2
            B = (y1 * y2) % p, // B = Y1 * Y2
            C = (d * t1 * t2) % p, // C = d * T1 * T2
            D = (z1 * z2) % p, // D = Z1 * Z2
            E1 = (x1 + y1) % p,
            E2 = (x2 + y2) % p,
            E = (E1 * E2 - A - B) % p, // E = (X1 + Y1) * (X2 + Y2) - A - B
            F = (D - C) % p, // F = D - C
            G = (D + C) % p, // G = D + C
            H = (B - a * A) % p, // H = B - a * A
            x3 = posMod(E * F, p), // X3 = E * F
            y3 = posMod(G * H, p), // Y3 = G * H
            t3 = posMod(E * H, p), // T3 = E * H
            z3 = posMod(F * G, p) // Z3 = F * G

        return new TEdwardsPoint(this.group, x3, y3, t3, z3) as this
    }
    toAffine(): { x: bigint; y: bigint } {
        const zInv = invMod(this.z, this.group.p),
            x = posMod(this.x * zInv, this.group.p),
            y = posMod(this.y * zInv, this.group.p)
        this.x = x
        this.y = y
        this.t = posMod(x * y, this.group.p)
        this.z = BigInt(1)
        return { x, y }
    }
    // Format: (0x04 || x || y ) using 33 bytes per coordinate in big-endian.
    toBytes(): Uint8Array {
        const { x, y } = this.toAffine(),
            coordSize = this.group.sizeFieldBytes(),
            ret = new Uint8Array(this.group.sizePointBytes())
        ret[0] = 0x04
        ret.set(toBytes(x, coordSize), 1)
        ret.set(toBytes(y, coordSize), 1 + coordSize)
        return ret
    }
    protected afterJson(): void {
        this.t = posMod(this.x * this.y, this.group.p)
        if (!this.group.isOnGroup(this)) {
            throw new Error(`point not on TEdwards group: ${this.group.name} `)
        }
    }
}

jsonObject({ knownTypes: [TEdwards] })(Group)
jsonObject({ knownTypes: [TEdwardsPoint] })(Group.Point)
