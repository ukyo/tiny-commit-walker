export function readBaseOffset(buff: Buffer, offset: number) {
  let c = buff[offset++];
  let baseOffset = c & 0x7f;
  while (c & 0x80) {
    baseOffset++;
    c = buff[offset++];
    baseOffset = baseOffset * 128 + (c & 0x7f);
  }
  return [baseOffset, offset];
}

function readDataSize(buff: Buffer, offset: number) {
  let cmd: number;
  let size = 0;
  let x = 1;
  do {
    cmd = buff[offset++];
    size += (cmd & 0x7f) * x;
    x *= 128;
  } while (cmd & 0x80);
  return [size, offset];
}

export function patchDelta(src: Buffer, delta: Buffer) {
  let srcOffset = 0;
  let srcSize;
  let dstSize;
  [srcSize, srcOffset] = readDataSize(delta, srcOffset);
  [dstSize, srcOffset] = readDataSize(delta, srcOffset);
  let dstOffset = 0;
  let cmd: number;
  const dst = Buffer.alloc(dstSize);
  while (srcOffset < delta.length) {
    cmd = delta[srcOffset++];
    if (cmd & 0x80) {
      let cpOff = 0;
      let cpSize = 0;
      if (cmd & 0x01) cpOff = delta[srcOffset++];
      if (cmd & 0x02) cpOff |= (delta[srcOffset++] << 8);
      if (cmd & 0x04) cpOff |= (delta[srcOffset++] << 16);
      if (cmd & 0x08) cpOff |= (delta[srcOffset++] << 24);
      if (cmd & 0x10) cpSize = delta[srcOffset++];
      if (cmd & 0x20) cpSize |= (delta[srcOffset++] << 8);
      if (cmd & 0x40) cpSize |= (delta[srcOffset++] << 16);
      if (cpSize === 0) cpSize = 0x10000;
      dst.set(src.slice(cpOff, cpOff + cpSize), dstOffset);
      dstOffset += cpSize;
      dstSize -= cpSize;
    } else if (cmd) {
      if (cmd > dstSize) {
        break;
      }
      dst.set(delta.slice(srcOffset, srcOffset + cmd), dstOffset);
      dstOffset += cmd;
      srcOffset += cmd;
      dstSize -= cmd;
    }
  }
  return dst;
}
