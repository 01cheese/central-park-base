/**
 * Central Park — lib/crypto.ts
 *
 * Zero-Knowledge cryptography layer.
 *
 * KEY DERIVATION STRATEGY (Double-Key):
 *   Master Password + User ID  →  PBKDF2 (300k iterations, SHA-256)
 *                                   ├─ Key A (Auth)  — SHA-256'd again before hitting server
 *                                   └─ Key B (Enc)   — AES-GCM key, never leaves the browser
 *
 * Security notes:
 * - Key A is hashed a second time (SHA-256) before sending to the server.
 *   Even if the DB is compromised, the attacker gets a one-way hash —
 *   not actual key material, so Key B remains safe.
 * - userId is embedded in the salt so two users with identical passwords
 *   produce completely different keys (defeats cross-user rainbow tables).
 * - encKey is imported as non-extractable — the JS runtime cannot expose raw bytes.
 */

const ENC = new TextEncoder();
const DEC = new TextDecoder();

// ─── Internals ──────────────────────────────────────────────────────────────

async function importPasswordMaterial(password: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        "raw",
        ENC.encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
    );
}

async function pbkdf2Bits(
    material: CryptoKey,
    salt: BufferSource,
    iterations: number,
    bits: number
): Promise<ArrayBuffer> {
    return crypto.subtle.deriveBits(
        { name: "PBKDF2", hash: "SHA-256", salt, iterations },
        material,
        bits
    );
}

function toHex(buf: ArrayBuffer): string {
    return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

function fromBase64(str: string): Uint8Array {
    return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

function toBase64(buf: ArrayBuffer | Uint8Array): string {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    return btoa(String.fromCharCode(...bytes));
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface DerivedKeys {
    /** SHA-256(KeyA) as hex — sent to server for vault lookup / creation */
    authKeyHash: string;
    /** AES-GCM CryptoKey — stays in browser memory only, never sent anywhere */
    encKey: CryptoKey;
}

/**
 * Derive auth + encryption keys from master password and userId.
 * Call once on login; cache result in the Zustand store (in-memory only).
 *
 * ~600ms on modern hardware due to 300k PBKDF2 iterations (intentional).
 */
export async function deriveKeys(
    masterPassword: string,
    userId: string
): Promise<DerivedKeys> {
    const material = await importPasswordMaterial(masterPassword);

    // Purpose-tagged salts ensure Key A and Key B are independent
    const saltA = ENC.encode(`centralpark::auth::${userId}`);
    const saltB = ENC.encode(`centralpark::enc::${userId}`);

    const [rawA, rawB] = await Promise.all([
        pbkdf2Bits(material, saltA, 300_000, 256),
        pbkdf2Bits(material, saltB, 300_000, 256),
    ]);

    // Double-hash Key A before it touches the server
    const authKeyHashBuf = await crypto.subtle.digest("SHA-256", rawA);
    const authKeyHash = toHex(authKeyHashBuf);

    // Import Key B as non-extractable AES-GCM key
    const encKey = await crypto.subtle.importKey(
        "raw",
        rawB,
        { name: "AES-GCM", length: 256 },
        false, // non-extractable
        ["encrypt", "decrypt"]
    );

    return { authKeyHash, encKey };
}

/**
 * Encrypt any JSON-serializable value.
 * Output format: `base64(96-bit IV) . base64(AES-GCM ciphertext+tag)`
 */
export async function encryptPayload(
    data: unknown,
    encKey: CryptoKey
): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12)); // fresh random IV every call
    const plaintext = ENC.encode(JSON.stringify(data));

    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, tagLength: 128 },
        encKey,
        plaintext
    );

    return `${toBase64(iv)}.${toBase64(ciphertext)}`;
}

/**
 * Decrypt an encrypted payload string.
 * Throws `DOMException` if the key is wrong or the ciphertext was tampered with
 * (AES-GCM authentication tag verification fails automatically).
 */
export async function decryptPayload<T = unknown>(
    payload: string,
    encKey: CryptoKey
): Promise<T> {
    const sep = payload.indexOf(".");
    if (sep === -1) throw new Error("Malformed payload: missing IV separator");

    const iv = fromBase64(payload.slice(0, sep));
    const ciphertext = fromBase64(payload.slice(sep + 1));

    const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv, tagLength: 128 },
        encKey,
        ciphertext
    );

    return JSON.parse(DEC.decode(plaintext)) as T;
}