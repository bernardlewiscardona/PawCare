const hex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

/**
 * A UUIDv7 generator (RFC 9562). The caller supplies randomness (`expo-crypto` on the phone,
 * `node:crypto` in tests). IDs from one generator are strictly increasing: a 12-bit counter
 * (method 1) orders IDs within a millisecond, and on overflow the timestamp moves forward 1 ms.
 */
export function createUuidV7(
  randomBytes: (n: number) => Uint8Array,
  now: () => number = Date.now,
): () => string {
  let lastMs = -1;
  let counter = 0;

  return () => {
    const random = randomBytes(10);
    const ms = now();
    if (ms > lastMs) {
      lastMs = ms;
      // Seed only the lower 11 bits so a full millisecond of IDs fits before overflow.
      counter = ((random[0] << 8) | random[1]) & 0x7ff;
    } else {
      counter += 1;
      if (counter > 0xfff) {
        lastMs += 1;
        counter = ((random[0] << 8) | random[1]) & 0x7ff;
      }
    }

    const bytes = new Uint8Array(16);
    // 48-bit big-endian millisecond timestamp (division, since bit operators are 32-bit).
    let timestamp = lastMs;
    for (let i = 5; i >= 0; i--) {
      bytes[i] = timestamp % 256;
      timestamp = Math.floor(timestamp / 256);
    }
    bytes[6] = 0x70 | (counter >> 8);
    bytes[7] = counter & 0xff;
    bytes[8] = 0x80 | (random[2] & 0x3f);
    bytes.set(random.subarray(3, 10), 9);

    const text = hex(bytes);
    return `${text.slice(0, 8)}-${text.slice(8, 12)}-${text.slice(12, 16)}-${text.slice(16, 20)}-${text.slice(20)}`;
  };
}
