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

import { readJson, writeJson } from '../../src/serde.js'

import { ALL_GROUPS } from '../../src/curves/instances.js'
import Benchmark from 'benchmark'
import { Group } from '../../src/curves/group.js'

export function bench(): Benchmark.Suite {
    const suite = new Benchmark.Suite()

    for (const group of ALL_GROUPS) {
        const k = group.randomScalar()
        let p = group.generator().mul(k),
            p2 = p.dbl()
        const json = writeJson(Group.Point, p),
            bytes = p.toBytes()
        console.log(`Point json  size ${group.name}:`, json.length)
        console.log(`Point bytes size ${group.name}:`, bytes.length)

        suite
            .add(`${group.name}/ec/add`, () => {
                p2 = p.add(p2)
            })
            .add(`${group.name}/ec/dbl`, () => {
                p = p.dbl()
            })
            .add(`${group.name}/ec/mul`, () => {
                p = p.mul(k)
            })
            .add(`${group.name}/ec/toJson`, () => {
                writeJson(Group.Point, p)
            })
            .add(`${group.name}/ec/fromJson`, () => {
                readJson(Group.Point, json)
            })
            .add(`${group.name}/ec/toBytes`, () => {
                p.toBytes()
            })
            .add(`${group.name}/ec/fromBytes`, () => {
                group.deserializePoint(bytes)
            })
    }

    return suite
}
