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

import { MultProof, proveMult, verifyMult } from '../../src/commit/mult.js'

import { generatePedersenParams } from '../../src/commit/pedersen.js'
import { rnd } from '../../src/bignum/big.js'
import { serdeTest } from '../serde.test.js'
import { tomEdwards256 } from '../../src/curves/instances.js'

export async function testMultProof(): Promise<boolean> {
    const ped = generatePedersenParams(tomEdwards256),
        x = rnd(tomEdwards256.order),
        y = rnd(tomEdwards256.order),
        Cx = ped.commit(x),
        Cy = ped.commit(y),
        z = (x * y) % tomEdwards256.order,
        Cz = ped.commit(z),
        proof = await proveMult(ped, x, y, z, Cx, Cy, Cz),
        res = await verifyMult(ped, Cx.p, Cy.p, Cz.p, proof)
    if (!res) {
        return false
    }

    if (!serdeTest(MultProof, proof)) {
        return false
    }
    return true
}
