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

import { Serializable, TypedJSON } from 'typedjson'

export type Newable<T> = Serializable<T>

export function readJson<T>(type: Newable<T>, text: string): T {
    const ser = new TypedJSON<T>(type, {
            errorHandler: (e: Error) => {
                throw e
            },
        }),
        obj = ser.parse(text)
    if (obj) {
        return obj
    }
    throw new Error('bad parsing')
}

export function writeJson<T>(type: Newable<T>, object: T): string {
    return TypedJSON.stringify(object, type)
}
