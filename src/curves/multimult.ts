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

import { Group } from './group.js'

class Pair {
    public pt: Group.Point
    public scalar: Group.Scalar
    constructor(pt: Group.Point, scalar: Group.Scalar) {
        this.pt = pt
        this.scalar = scalar
    }
    public cmp(b: Pair): number {
        return this.scalar.cmp(b.scalar)
    }
}

export class MultiMult {
    public readonly group: Group
    private pairs: Pair[]
    private known: { pt: Group.Point; idx: number }[]

    constructor(g: Group) {
        this.group = g
        this.pairs = []
        this.known = []
    }

    public addKnown(pt: Group.Point): void {
        this.group.isCompatPoint(pt)
        if (!this.known.some((x) => pt.eq(x.pt))) {
            const newlen = this.pairs.push(new Pair(pt, this.group.newScalar(BigInt(0))))
            this.known.push({ pt: pt, idx: newlen - 1 })
        }
    }

    public insert(pt: Group.Point, s: Group.Scalar): void {
        this.group.isCompatPoint(pt)
        this.group.isCompatScalar(s)
        const match = this.known.find((x) => pt.eq(x.pt))
        if (match != undefined) {
            this.pairs[match.idx].scalar = this.pairs[match.idx].scalar.add(s)
        } else {
            this.pairs.push(new Pair(pt, s))
        }
    }

    public evaluate(): Group.Point {
        if (this.pairs.length === 0) {
            return this.group.identity()
        }
        if (this.pairs.length === 1) {
            const a = this.pairs[0]
            return a.pt.mul(a.scalar)
        }
        heapify(this.pairs)
        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (this.pairs.length === 1) {
                const a = this.pairs[0]
                return a.pt.mul(a.scalar)
            }
            const a = extractMax(this.pairs),
                b = this.pairs[0]
            if (b.scalar.isZero()) {
                return a.pt.mul(a.scalar)
            }
            const c = new Pair(a.pt, a.scalar.sub(b.scalar)),
                d = new Pair(b.pt.add(a.pt), b.scalar)
            this.pairs[0] = d
            if (!c.scalar.isZero()) {
                this.pairs.push(c)
                bubbleup(this.pairs, this.pairs.length)
            }
        }
    }
}

function extractMax(arr: Pair[]): Pair {
    // We shrink the heap
    const t = arr[0]
    arr[0] = arr[arr.length - 1]
    arr[arr.length - 1] = t
    const max = arr.pop()
    if (max == undefined) {
        throw new Error('heap underflow')
    }
    pushdown(arr, 1)
    return max
}

function heapify(arr: Pair[]) {
    for (let i = 0; i < arr.length; i++) {
        bubbleup(arr, i + 1)
    }
}

function bubbleup(arr: Pair[], index: number) {
    // The indexing is easiest if 1 based
    if (index == 0 || index == 1) {
        return
    }
    const parent = Math.floor(index / 2)
    if (arr[parent - 1].cmp(arr[index - 1]) < 0) {
        const t = arr[index - 1]
        arr[index - 1] = arr[parent - 1]
        arr[parent - 1] = t
        bubbleup(arr, parent)
    }
}

function pushdown(arr: Pair[], parent: number) {
    const son = 2 * parent,
        daughter = 2 * parent + 1
    if (son > arr.length) {
        return
    }
    let child = son
    if (daughter <= arr.length) {
        // Handle parents with one child
        if (arr[daughter - 1].cmp(arr[son - 1]) > 0) {
            child = daughter
        }
    }

    if (arr[parent - 1].cmp(arr[child - 1]) < 0) {
        const t = arr[child - 1]
        arr[child - 1] = arr[parent - 1]
        arr[parent - 1] = t
        pushdown(arr, child)
    }
}

export class Relation {
    public readonly group: Group
    private pairs: Pair[]
    constructor(g: Group) {
        this.group = g
        this.pairs = []
    }
    public insertM(pts: Group.Point[], scalars: Group.Scalar[]): void {
        if (pts.length !== scalars.length) {
            throw new Error('arrays are not the same length')
        }
        for (let i = 0; i < pts.length; i++) {
            this.insert(pts[i as number], scalars[i as number])
        }
    }
    public insert(pt: Group.Point, s: Group.Scalar): void {
        this.group.isCompatPoint(pt)
        this.group.isCompatScalar(s)
        this.pairs.push(new Pair(pt, s))
    }

    public drain(m: MultiMult): void {
        const randomizer = this.group.randomScalar()
        for (let i = 0; i < this.pairs.length; i++) {
            m.insert(this.pairs[i as number].pt, this.pairs[i as number].scalar.mul(randomizer))
        }
    }
}
