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

import { Newable, readJson, writeJson } from '../src/serde.js'

import { Comparable } from '../src/util.js'

export function serdeTest<T extends Newable<U>, U extends Comparable<U>>(type: T, object: U): boolean {
    try {
        const json = writeJson(type, object),
            object2 = readJson(type, json)
        return object.eq(object2)
    } catch (e) {
        console.log('Serialization error: ', typeof object)
        console.log(e.message)
        console.log(e.stack)
        return false
    }
}
