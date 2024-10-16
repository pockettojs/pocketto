import sodium from 'libsodium-wrappers';

const key: {
    [key: string]: Uint8Array;
} = {};
const nonce: {
    [key: string]: Uint8Array;
} = {};

export const transformer = {
    dbName: '',
    incoming: function (doc: any) {
        const encrypted = encrypt({ ...doc, }, this.dbName);
        return {
            _id: doc._id,
            _rev: doc._rev,
            payload: encrypted,
        };
    },
    outgoing: function (doc: any) {
        if (!doc.payload) {
            return doc;
        }
        const output = decrypt(doc.payload, this.dbName);
        return {
            _id: doc._id,
            _rev: doc._rev,
            ...output,
        };
    },
};


export async function setEncryptionPassword(password: string, dbName: string) {
    await sodium.ready;

    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password.padEnd(32, ' '));
    key[dbName] = passwordBytes.slice(0, sodium.crypto_secretbox_KEYBYTES);

    const nonceBytes = encoder.encode(password.padEnd(24, ' '));
    nonce[dbName] = nonceBytes.slice(0, sodium.crypto_secretbox_NONCEBYTES);
}

export function encrypt(data: any, dbName: string): string {
    delete data._id;
    delete data._rev;
    const ciphertext = sodium.crypto_secretbox_easy(JSON.stringify(data), nonce[dbName], key[dbName]);
    const base64CipherText = sodium.to_base64(ciphertext);
    return base64CipherText;
}

export function decrypt(data: string, dbName: string): any {
    const ciphertext = sodium.from_base64(data);
    const decrypted = sodium.crypto_secretbox_open_easy(ciphertext, nonce[dbName], key[dbName]);
    const decoder = new TextDecoder('utf-8');
    const decryptedString = decoder.decode(decrypted);
    return JSON.parse(decryptedString);
}