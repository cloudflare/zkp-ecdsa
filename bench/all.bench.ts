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

import * as big from './bignum/big.bench.js'
import * as ec from './curves/ec.bench.js'
import * as equality from './commit/equality.bench.js'
import * as exp from './exp/exp.bench.js'
import * as gk from './proofGK/gk.bench.js'
import * as mult from './commit/mult.bench.js'
import * as pedersen from './commit/pedersen.bench.js'
import * as pointAdd from './exp/pointAdd.bench.js'
import * as zkpAttestList from './zkpAttestList.bench.js'

import Benchmark from 'benchmark'
import isomCrypto from 'node-webcrypto-shim'

global.crypto = isomCrypto

const benchs = [
    { name: 'big', bench: big.bench },
    { name: 'ec', bench: ec.bench },
    { name: 'exp', bench: exp.bench },
    { name: 'pointAdd', bench: pointAdd.bench },
    { name: 'mult', bench: mult.bench },
    { name: 'equality', bench: equality.bench },
    { name: 'pedersen', bench: pedersen.bench },
    { name: 'gk', bench: gk.bench },
    { name: 'zkpAttestList', bench: zkpAttestList.bench },
]

async function runBenchmarks(): Promise<void> {
    const benchName = process.argv[2]
    let runOne = false
    if (benchName && benchName.slice(0, 2) !== '--') {
        runOne = true
        console.log('Running single bench ' + benchName)
    }

    let ran = false
    for (const benchPair of benchs) {
        const { bench, name } = benchPair
        if (runOne && name != benchName) continue
        console.log(`executing bench ${name}`)
        ran = true
        try {
            const suite = await bench()
            suite
                .on('cycle', (event: Benchmark.Event) => {
                    console.log(String(event.target))
                })
                .run({ async: false })
        } catch (e) {
            console.log('Error: ' + e.message)
            console.log('Stack: ' + e.stack)
        }
    }
    if (!ran && runOne) {
        console.log(`did not find bench with name ${process.argv[2]}`)
        process.exit(1)
    }
}

runBenchmarks()
