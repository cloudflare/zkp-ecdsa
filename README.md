[![NPM](https://img.shields.io/npm/v/@cloudflare/zkp-ecdsa?style=plastic)](https://www.npmjs.com/package/@cloudflare/zkp-ecdsa) [![NPM](https://img.shields.io/npm/l/@cloudflare/zkp-ecdsa?style=plastic)](LICENSE.txt) [![DOI](https://zenodo.org/badge/DOI/10.1007/978-3-030-99277-4_4.svg)](https://doi.org/10.1007/978-3-030-99277-4_4)

[![NPM](https://nodei.co/npm/@cloudflare/zkp-ecdsa.png)](https://www.npmjs.com/package/@cloudflare/zkp-ecdsa)

# zkp-ecdsa: A Typescript Implementation of ZKAttest

**ZKAttest** proofs knowledge of an ECDSA-P256 signature under one of many public keys that are stored in a list without revealing which public key was used to sign the message.

| [Usage](#usage) | [Development](#development) | [Cite This](#citation) | [Future Work](#future-work) |
|--|--|--|--|

---

### Usage

Ready to use ZKAttest proofs, follow this short guideline.

#### Step 1
Suppose you already have a signature of a message using ECDSA (P-256). Otherwise, create signature as follows:

```ts
// Message to be signed.
const msg = new TextEncoder().encode('kilroy was here');

// Generate a keypair for signing.
const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true, [ 'sign', 'verify'],
);

// Sign a message as usual.
const msgHash = new Uint8Array(await crypto.subtle.digest('SHA-256', msg));
const signature = new Uint8Array(
    await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        keyPair.privateKey, msgHash,
    )
);
```

#### Step 2

Then, insert your public key in a ring of keys. This allows to hide your public key behind the ring of keys. (In this example, assume the list was generated with valid keys).

```ts
import { keyToInt } from '@cloudflare/zkp-ecdsa'

// Add the public key to an existing ring of keys,
const listKeys = [BigInt(4), BigInt(5), BigInt(6), BigInt(7), BigInt(8)];
listKeys.unshift(await keyToInt(keyPair.publicKey));
```

#### Step 3

Now, create a **ZKAttest proof of knowledge** showing that
- the signature was generated using the private key, AND
- the public key is in the ring.

However, the proof does not reveal which public key was used during signing.

```ts
import { generateParamsList, proveSignatureList } from '@cloudflare/zkp-ecdsa'

// Create a zero-knowledge proof about the signature.
const params = generateParamsList();
const zkAttestProof = await proveSignatureList(
    params,
    msgHash,
    signature,
    keyPair.publicKey,
    0, // position of the public key in the list.
    listKeys
);
```

#### Step 4

After this, everyone can verify the proof is valid, which means the message was signed by the holder of an ECDSA key pair, but without identifying exactly which one of the keys in the ring was used to produce the proof. Do not disclose the original signature as it is already embedded inside the proof.

```ts
import { verifySignatureList } from '@cloudflare/zkp-ecdsa'
// Verify that zero-knowledge proof is valid.
const valid = await verifySignatureList(params, msgHash, listKeys, zkAttestProof)
console.assert(valid == true)
```

That's all.

---

### Citation

This software library is part of the article _["ZKAttest: Ring and Group Signatures for Existing ECDSA Keys"](https://doi.org/10.1007/978-3-030-99277-4_4)_ published at [Selected Areas in Cryptography (SAC 2021)](https://www.sac2021.ca/) authored by Armando Faz Hernández, Watson Ladd, and Deepak Maram.

A copy of this paper can be downloaded at [research.cloudflare.com](https://research.cloudflare.com/publications/Faz-Hernandez2021/) or at the [IACR ePrint 2021/1183](https://eprint.iacr.org/2021/1183).

To cite this library, use one of the following formats and update the version and date you accessed to this project.

**APA Style**

Faz-Hernández, A., Ladd, W., Maram, D. (2021). ZKAttest: Ring and Group Signatures for Existing ECDSA Keys. In: AlTawy, R., Hülsing, A. (eds) Selected Areas in Cryptography. SAC 2021. Available at https://github.com/cloudflare/zkp-ecdsa. v0.2.5 Accessed Nov 2022.

**BibTex Source**

```bibtex
@inproceedings{zkattest,
  doi       = {10.1007/978-3-030-99277-4_4},
  title     = {ZKAttest: Ring and Group Signatures for Existing ECDSA Keys},
  author    = {Faz-Hernández, Armando and Ladd, Watson and Maram, Deepak},
  booktitle = {Selected Areas in Cryptography},
  editor    = {AlTawy, Riham and Hülsing, Andreas},
  publisher = {Springer International Publishing},
  address   = {Cham},
  isbn      = {978-3-030-99277-4},
  pages     = {68--83},
  month     = {oct},
  year      = {2021},
  note      = {Available at \url{https://github.com/cloudflare/zkp-ecdsa}.
               v0.2.5 Accessed Nov 2022},
}
```

**CFF Style**

Find attached a [CITATION.cff](CITATION.cff) file.

---

### Development

| Task | NPM scripts |
|--|--|
| Installing         | `$ npm ci`         |
| Building           | `$ npm run build`  |
| Unit Tests         | `$ npm run test`   |
| Benchmarking       | `$ npm run bench`  |
| Flamegraph Profile | `$ npm run flame`  |
| Code Linting       | `$ npm run lint`   |
| Code Formating     | `$ npm run format` |
| Bundling  Library  | `$ npm run bundle` |

---

### Future Work
 - Accelerate proof verification.
 - Implement the proof in other programming languages.
 - Remove dependency on native Bignum.

---

### License

The project is licensed under the [Apache 2.0 License](LICENSE.txt)
