export function uuid() {
  const cryptoObj = self.crypto || window.crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  const buf = new Uint8Array(16);
  (cryptoObj?.getRandomValues || ((arr) => arr))(buf);
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  const toHex = (n) => n.toString(16).padStart(2, "0");
  const hex = Array.from(buf, toHex).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
