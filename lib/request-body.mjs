export async function readLimitedBody(request, limit = 12 * 1024 * 1024) {
  const tooLarge = () => Object.assign(new Error("Permintaan terlalu besar."), {status:413});
  if (Number(request.headers.get("content-length") || 0) > limit) throw tooLarge();
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = []; let size = 0;
  while (true) {
    const {done,value} = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw tooLarge(); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
  return bytes;
}
