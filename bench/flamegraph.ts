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

import './mockCrypto.js'

import { generateParamsList, keyToInt, proveSignatureList, verifySignatureList } from '../src/index.js'

async function main() {
    const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']),
        enc = new TextEncoder(),
        msg = enc.encode('kilroy was here'),
        msgHash = new Uint8Array(await crypto.subtle.digest('SHA-256', msg)),
        signature = new Uint8Array(
            await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, msg)
        ),
        params = generateParamsList(),
        testKey = await keyToInt(keyPair.publicKey),
        numKeys = 10,
        testArray = [testKey]
    for (let i = 0; i < numKeys; i++) {
        const newKey = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
        testArray.push(await keyToInt(newKey.publicKey))
    }

    const proof = await proveSignatureList(params, msgHash, signature, keyPair.publicKey, 0, testArray)
    for (let i = 0; i < 10; i++) {
        const res = await verifySignatureList(params, msgHash, testArray, proof)
        console.log(res)
    }
}

main()
