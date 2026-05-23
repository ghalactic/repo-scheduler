const PKCS1_PREFIX = "-----BEGIN RSA PRIVATE KEY-----";
const PKCS8_PREFIX = "-----BEGIN PRIVATE KEY-----";
const PKCS8_SUFFIX = "-----END PRIVATE KEY-----";

// RSA algorithm OID (1.2.840.113549.1.1.1) wrapped in an AlgorithmIdentifier
const PKCS8_HEADER = new Uint8Array([
  0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
  0x05, 0x00,
]);

export function ensurePkcs8(pem: string): string {
  if (!pem.includes(PKCS1_PREFIX)) return pem;

  const base64 = pem
    .replace(/-----(?:BEGIN|END) RSA PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const pkcs1 = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  // PKCS#8 wraps: SEQUENCE { version INTEGER 0, algorithmId, OCTET STRING { pkcs1 } }
  const version = new Uint8Array([0x02, 0x01, 0x00]);
  const octetString = wrapAsn1(0x04, pkcs1);
  const inner = concat(version, PKCS8_HEADER, octetString);
  const pkcs8 = wrapAsn1(0x30, inner);

  const encoded = btoa(String.fromCharCode(...pkcs8))
    .replace(/(.{64})/g, "$1\n")
    .trimEnd();

  return `${PKCS8_PREFIX}\n${encoded}\n${PKCS8_SUFFIX}`;
}

function wrapAsn1(tag: number, content: Uint8Array): Uint8Array {
  const len = encodeAsn1Length(content.length);
  const result = new Uint8Array(1 + len.length + content.length);
  result[0] = tag;
  result.set(len, 1);
  result.set(content, 1 + len.length);

  return result;
}

function encodeAsn1Length(length: number): Uint8Array {
  if (length < 0x80) return new Uint8Array([length]);

  const bytes: number[] = [];
  let remaining = length;

  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>= 8;
  }

  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }

  return result;
}
