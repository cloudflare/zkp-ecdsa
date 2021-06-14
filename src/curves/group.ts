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

import { fromBytes, posMod, rnd, serdeBigInt, toBytes, verifyPosRange } from '../bignum/big.js'
import { jsonMember, jsonObject, toJson } from 'typedjson'

export abstract class Group {
    @jsonMember({ constructor: String, isRequired: true }) name: string

    constructor(
        name: string, // name of the group
        public readonly p: bigint, // prime modulus
        public readonly order: bigint // order of the group
    ) {
        this.name = name
    }

    abstract identity(): Group.Point
    abstract generator(): Group.Point
    abstract isOnGroup(_: Group.Point): boolean
    abstract sizePointBytes(): number
    abstract deserializePoint(_: Uint8Array): Group.Point

    isCompatPoint(pt: Group.Point): true | never {
        if (!this.eq(pt.group)) {
            throw new Error('points not compatible')
        }
        return true
    }
    isCompatScalar(s: Group.Scalar): true | never {
        if (!this.eq(s.group)) {
            throw new Error('scalar not compatible')
        }
        return true
    }
    sizeFieldBytes(): number {
        const bitSize = this.p.toString(2).length
        return Math.ceil(bitSize / 8)
    }
    eq(g: Group): boolean {
        return this.name === g.name
    }
    newScalar(s: bigint): Group.Scalar {
        return new Group.Scalar(this, s)
    }
    randomScalar(): Group.Scalar {
        return this.newScalar(rnd(this.order))
    }
    deserializeScalar(a: Uint8Array): Group.Scalar {
        const s = fromBytes(a)
        verifyPosRange(s, this.order)
        return this.newScalar(s)
    }
}

/*eslint-disable-next-line @typescript-eslint/no-namespace */
export namespace Group {
    export abstract class Point {
        abstract readonly group: Group
        abstract isIdentity(): boolean
        abstract eq(_: Point): boolean
        abstract neg(): this
        abstract dbl(): this
        abstract add(_: this): this
        abstract toAffine(): { x: bigint; y: bigint } | false
        abstract toBytes(): Uint8Array

        isCompatPoint(pt: this): true | never {
            return this.group.isCompatPoint(pt)
        }
        isCompatScalar(s: Group.Scalar): true | never {
            return this.group.isCompatScalar(s)
        }
        static toStringCoords(coords: Array<{ name: string; value: bigint }>): string {
            let s = ''
            for (const { name, value } of coords) {
                s += `${name}:0x${value.toString(16)}\n`
            }
            return s
        }
        sub(pt: this): this {
            return this.add(pt.neg())
        }
        dblmul(s1: Group.Scalar, p2: this, s2: Group.Scalar): this {
            this.isCompatScalar(s1)
            this.isCompatScalar(s2)
            this.isCompatPoint(p2)

            const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'],
                mult1 = new Map(),
                mult2 = new Map()
            let curr1 = this.group.identity(),
                curr2 = p2.group.identity()
            for (const digit of digits) {
                mult1.set(digit, curr1)
                mult2.set(digit, curr2)
                curr1 = curr1.add(this)
                curr2 = curr2.add(p2)
            }

            let k1 = s1.base16(),
                k2 = s2.base16()
            if (k1.length < k2.length) {
                k1 = k1.padStart(k2.length, '0')
            }
            if (k2.length < k1.length) {
                k2 = k2.padStart(k1.length, '0')
            }
            let q = this.group.identity() as this
            for (let i = 0; i < k1.length; i++) {
                q = q.dbl()
                q = q.dbl()
                q = q.dbl()
                q = q.dbl()
                q = q.add(mult1.get(k1[i as number]))
                q = q.add(mult2.get(k2[i as number]))
            }
            return q
        }
        mul(s: Group.Scalar): this {
            this.isCompatScalar(s)
            const k = s.base16()
            let q = this.group.identity() as this
            const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'],
                mults = new Map()
            let curr = this.group.identity()
            for (const digit of digits) {
                mults.set(digit, curr)
                curr = curr.add(this)
            }
            for (const ki of k) {
                q = q.dbl()
                q = q.dbl()
                q = q.dbl()
                q = q.dbl()
                q = q.add(mults.get(ki))
            }
            return q
        }
    }

    @jsonObject({
        beforeSerialization: 'reduce',
    })
    @toJson
    export class Scalar {
        @jsonMember({ constructor: Group, isRequired: true }) readonly group: Group
        @jsonMember(serdeBigInt) public k: bigint

        // Scalar is not exported, use Curve.newScalar method to get an scalar object.
        constructor(group: Group, s: bigint) {
            this.group = group
            this.k = s ? posMod(s, group.order) : BigInt(0)
        }
        toString(): string {
            this.reduce()
            return '0x' + this.k.toString(16)
        }
        bits(): string {
            this.reduce()
            return this.k.toString(2)
        }
        base16(): string {
            return this.k.toString(16)
        }
        eq(s: Scalar): boolean {
            this.reduce()
            s.reduce()
            return this.group.eq(s.group) && this.k === s.k
        }
        add(s: Scalar): Scalar {
            return new Scalar(this.group, this.k + s.k)
        }
        sub(s: Scalar): Scalar {
            return new Scalar(this.group, this.k - s.k)
        }
        mul(s: Scalar): Scalar {
            return new Scalar(this.group, this.k * s.k)
        }
        neg(): Scalar {
            return new Scalar(this.group, -this.k)
        }
        toBytes(): Uint8Array {
            this.reduce()
            return toBytes(this.k, this.group.sizeFieldBytes())
        }
        isOne(): boolean {
            return this.k === BigInt(1)
        }
        isZero(): boolean {
            return this.k === BigInt(0)
        }
        cmp(s: Scalar): number {
            if (this.k < s.k) {
                return -1
            } else if (this.k > s.k) {
                return 1
            } else {
                return 0
            }
        }
        protected reduce(): void {
            this.k = posMod(this.k, this.group.order)
        }
    }
}

export async function hashPoints(hashID: string, points: Group.Point[]): Promise<bigint> {
    const bytesPoints = points.map((p) => p.toBytes()),
        size = bytesPoints.map((b) => b.length).reduce((sum, cur) => sum + cur),
        bytes = new Uint8Array(size)
    let offset = 0
    for (const bP of bytesPoints) {
        bytes.set(bP, offset)
        offset += bP.length
    }
    const buf = await crypto.subtle.digest(hashID, bytes),
        hash = new Uint8Array(buf)
    return fromBytes(hash.slice(0, 10))
}
