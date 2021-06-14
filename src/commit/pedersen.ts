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

import { jsonMember, jsonObject, toJson } from 'typedjson'

import { Group } from '../curves/group.js'

export class Commitment {
    constructor(public p: Group.Point, public r: Group.Scalar) {}
    add(c: Commitment): Commitment {
        return new Commitment(this.p.add(c.p), this.r.add(c.r))
    }
    mul(k: bigint): Commitment {
        const sk = this.p.group.newScalar(k)
        return new Commitment(this.p.mul(sk), this.r.mul(sk))
    }
    sub(c: Commitment): Commitment {
        return new Commitment(this.p.sub(c.p), this.r.sub(c.r))
    }
}

@jsonObject
@toJson
export class PedersenParams {
    @jsonMember({ constructor: Group, isRequired: true }) c: Group
    @jsonMember({ constructor: Group.Point, isRequired: true }) g: Group.Point
    @jsonMember({ constructor: Group.Point, isRequired: true }) h: Group.Point
    constructor(c: Group, g: Group.Point, h: Group.Point) {
        this.c = c
        this.g = g
        this.h = h
    }
    eq(o: PedersenParams): boolean {
        return this.c.eq(o.c) && this.g.eq(o.g) && this.h.eq(o.h)
    }

    commit(input: bigint): Commitment {
        const r = this.c.randomScalar(),
            v = this.c.newScalar(input),
            p = this.h.dblmul(r, this.g, v)
        return new Commitment(p, r)
    }
}

export function generatePedersenParams(c: Group, g?: Group.Point): PedersenParams {
    // todo(correctness): we must generate h without using scalar mult.
    if (!g) {
        g = c.generator()
    }
    const r = c.randomScalar(),
        h = g.mul(r)
    return new PedersenParams(c, g, h)
}
