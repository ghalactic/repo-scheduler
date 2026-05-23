import { expect, it } from "vitest";
import { ensurePkcs8 } from "./pkcs.js";

const PKCS1_PEM = [
  "-----BEGIN RSA PRIVATE KEY-----",
  "MIIBogIBAAJBALRiMLAHudeSA/x3hB2f+2NRkJLA1MFCPqESTEbOhXjQ5sJ4tu",
  "e5hRLOcbPJDUMvG9GZq1UaLBHkHkYKGnJHHcCAwEAAQJAB8UuKBIWMDG9FidA9/",
  "ztFB56Fy4C9e5LQSD2bmmHprb7mSQVMGS6q+LQP//QK4YQi+4P5cBLTGfKxBbh0",
  "cQJhANx0zzj1BB6A6Vhn2MaebTG/VrEWOGSrg3TlV7FSf73Fv9mB/M3HCvn8bQ",
  "-----END RSA PRIVATE KEY-----",
].join("\n");

const PKCS8_PEM = [
  "-----BEGIN PRIVATE KEY-----",
  "already-pkcs8",
  "-----END PRIVATE KEY-----",
].join("\n");

it("converts PKCS#1 PEM to PKCS#8 PEM", () => {
  const result = ensurePkcs8(PKCS1_PEM);

  expect(result).toMatch(/^-----BEGIN PRIVATE KEY-----\n/);
  expect(result).toMatch(/\n-----END PRIVATE KEY-----$/);
  expect(result).not.toContain("RSA PRIVATE KEY");
});

it("returns PKCS#8 PEM unchanged", () => {
  expect(ensurePkcs8(PKCS8_PEM)).toBe(PKCS8_PEM);
});

it("returns non-PEM strings unchanged", () => {
  const raw = "some-raw-key-data";

  expect(ensurePkcs8(raw)).toBe(raw);
});

it("wraps the PKCS#1 body in valid PKCS#8 ASN.1 structure", () => {
  const result = ensurePkcs8(PKCS1_PEM);

  const base64 = result
    .replace(/-----(?:BEGIN|END) PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  expect(bytes[0]).toBe(0x30);

  const oid = [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01];
  const bytesStr = Array.from(bytes).join(",");
  expect(bytesStr).toContain(oid.join(","));
});

it("produces base64 lines no longer than 64 characters", () => {
  const result = ensurePkcs8(PKCS1_PEM);
  const lines = result.split("\n").slice(1, -1);

  for (const line of lines) {
    expect(line.length).toBeLessThanOrEqual(64);
  }
});

it("handles keys with DER length >= 128 bytes (long-form ASN.1 length)", () => {
  const fakeDer = new Uint8Array(256);
  for (let i = 0; i < fakeDer.length; i++) fakeDer[i] = i & 0xff;

  const largeBase64 = btoa(String.fromCharCode(...fakeDer))
    .replace(/(.{64})/g, "$1\n")
    .trimEnd();
  const largePkcs1 = `-----BEGIN RSA PRIVATE KEY-----\n${largeBase64}\n-----END RSA PRIVATE KEY-----`;

  const result = ensurePkcs8(largePkcs1);

  expect(result).toMatch(/^-----BEGIN PRIVATE KEY-----\n/);
  expect(result).toMatch(/\n-----END PRIVATE KEY-----$/);

  const body = result
    .replace(/-----(?:BEGIN|END) PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));

  expect(bytes[0]).toBe(0x30);
  expect(bytes[1] & 0x80).toBe(0x80);
});

it("handles keys with DER length < 128 bytes (short-form ASN.1 length)", () => {
  const fakeDer = new Uint8Array(50);
  for (let i = 0; i < fakeDer.length; i++) fakeDer[i] = i & 0xff;

  const smallBase64 = btoa(String.fromCharCode(...fakeDer))
    .replace(/(.{64})/g, "$1\n")
    .trimEnd();
  const smallPkcs1 = `-----BEGIN RSA PRIVATE KEY-----\n${smallBase64}\n-----END RSA PRIVATE KEY-----`;

  const result = ensurePkcs8(smallPkcs1);

  expect(result).toMatch(/^-----BEGIN PRIVATE KEY-----\n/);
  expect(result).toMatch(/\n-----END PRIVATE KEY-----$/);

  const body = result
    .replace(/-----(?:BEGIN|END) PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));

  expect(bytes[0]).toBe(0x30);
  expect(bytes[1] & 0x80).toBe(0);
});
