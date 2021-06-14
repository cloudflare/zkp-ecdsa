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

import * as big from './bignum/big.test.js'
import * as ec from './curves/ec.test.js'
import * as equality from './commit/equality.test.js'
import * as exp from './exp/exp.test.js'
import * as gk from './proofGK/gk.test.js'
import * as interpolate from './proofGK/interpolate.test.js'
import * as mult from './commit/mult.test.js'
import * as multiMult from './curves/multimult.test.js'
import * as pointAdd from './exp/pointAdd.test.js'
import * as zkpList from './zkpAttestList.test.js'

import isomCrypto from 'node-webcrypto-shim'

global.crypto = isomCrypto

const tests = [
    { name: 'zkpAttestList', test: zkpList.testZKP },
    { name: 'interpolate', test: interpolate.testInterpolate },
    { name: 'gk', test: gk.testGKProof },
    { name: 'ec', test: ec.testEc },
    { name: 'equality', test: equality.testEquality },
    { name: 'mult', test: mult.testMultProof },
    { name: 'multiMult', test: multiMult.testMultiMult },
    { name: 'pointAdd', test: pointAdd.testPointAdd },
    { name: 'big.testInvEuclid', test: big.testInvEuclid },
    { name: 'big.primality', test: big.testPrimality },
    { name: 'exp', test: exp.testExp },
]

async function runTests(): Promise<void> {
    const testName = process.argv[2]
    let runOne = false
    if (testName && testName.slice(0, 2) !== '--') {
        runOne = true
        console.log('Running single test ' + testName)
    }

    let ran = false,
        success = true
    for (const suite of tests) {
        const { test, name } = suite
        if (runOne && name != testName) continue
        console.log(`executing test ${name}`)
        ran = true
        try {
            const res = await test()
            if (res) {
                console.log(`passed test ${name}`)
            } else {
                console.log(`failed test ${name}`)
                success = false
            }
        } catch (e) {
            console.log('Error: ' + e.message)
            console.log('Stack: ' + e.stack)
        }
    }
    if (!success) {
        process.exit(1)
    }
    if (!ran && runOne) {
        console.log(`did not find test with name ${process.argv[2]}`)
        process.exit(1)
    }
}
runTests()
