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

import { MultiMult, Relation } from '../../src/curves/multimult.js'

import { ALL_GROUPS } from '../../src/curves/instances.js'

export async function testMultiMult(): Promise<boolean> {
    for (const group of ALL_GROUPS) {
        const multiMult = new MultiMult(group),
            relation = new Relation(group),
            pt = group.generator().mul(group.randomScalar())
        multiMult.addKnown(group.generator())
        let runningPt = group.newScalar(BigInt(0)),
            runningG = group.newScalar(BigInt(0))
        for (let i = 0; i < 10; i++) {
            const scalar = group.randomScalar()
            multiMult.insert(pt, scalar)
            relation.insert(pt, scalar)
            runningPt = runningPt.add(scalar)
            const scalarg = group.randomScalar()
            multiMult.insert(group.generator(), scalarg)
            relation.insert(group.generator(), scalarg)
            runningG = runningG.add(scalarg)
        }
        const a = multiMult.evaluate(),
            b = pt.mul(runningPt).add(group.generator().mul(runningG))
        if (!a.eq(b)) {
            console.log('incorrect evaluation')
            return false
        }
        relation.insert(pt.neg(), runningPt)
        relation.insert(group.generator().neg(), runningG)
        const relMulti = new MultiMult(group)
        relation.drain(relMulti)
        if (!relMulti.evaluate().isIdentity()) {
            return false
        }
    }

    return true
}
