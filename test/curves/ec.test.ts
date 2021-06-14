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

import { ALL_GROUPS } from '../../src/curves/instances.js'
import { Group } from '../../src/curves/group.js'
import { serdeTest } from '../serde.test.js'

export async function testEc(): Promise<boolean> {
    const testTimes = 100
    for (const group of ALL_GROUPS) {
        const P1 = group.generator().mul(group.newScalar(group.order))
        if (!(group.isOnGroup(P1) && P1.isIdentity())) {
            return false
        }

        for (let i = 0; i < testTimes; i++) {
            const k = group.randomScalar(),
                P = group.generator().mul(k)
            if (!group.isOnGroup(P)) {
                return false
            }
        }

        let k = group.randomScalar(),
            P = group.generator().mul(k)
        for (let i = 0; i < testTimes; i++) {
            k = group.randomScalar()
            P = P.mul(k)
            if (!group.isOnGroup(P)) {
                return false
            }
        }

        const r1 = group.newScalar(group.order - BigInt(1)),
            Q = P.mul(r1),
            R = P.add(Q)
        if (!R.isIdentity()) {
            return false
        }

        const k1 = group.randomScalar(),
            k2 = group.randomScalar(),
            S = P.dblmul(k1, Q, k2)
        if (!S.eq(P.mul(k1).add(Q.mul(k2)))) {
            return false
        }

        const I = group.identity(),
            Ibytes = I.toBytes(),
            deserI = group.deserializePoint(Ibytes)
        if (!deserI.eq(I)) {
            return false
        }

        for (let i = 0; i < testTimes; i++) {
            const sk = group.randomScalar(),
                pt = group.generator().mul(sk),
                bytesP = pt.toBytes(),
                deserP = group.deserializePoint(bytesP)
            if (!deserP.eq(pt)) {
                return false
            }
        }

        if (!serdeTest(Group, group)) {
            return false
        }
        if (!serdeTest(Group.Point, group.generator())) {
            return false
        }
        if (!serdeTest(Group.Scalar, group.randomScalar())) {
            return false
        }
    }

    return true
}
