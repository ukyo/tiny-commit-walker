import * as LRU from 'lru-cache';
import * as fs from 'fs';
import * as promisify from 'util.promisify';
import * as path from 'path';
import * as zlib from 'zlib';
import { Commit } from './commit';


const statAsync = promisify(fs.stat);
const readFileAsync = promisify(fs.readFile);
const readDirAsync = promisify(fs.readdir);
const openFileAsync = promisify(fs.open);
const closeFileAsync = promisify(fs.close);
const readAsync = promisify(fs.read);
const inflateAsync = promisify(zlib.inflate);

enum ObjectTypeEnum {
  BAD = -1,
  NONE = 0,
  COMMIT = 1,
  TREE = 2,
  BLOB = 3,
  TAG = 4,
  OFS_DELTA = 6,
  REF_DELTA = 7,
  ANY,
  MAX,
}

const HASH_COUNT_POSITION = (2 + 255) * 4;
const HASH_START_POSITION = HASH_COUNT_POSITION + 4;

const packsCache = LRU<Packs>(4);
const packedObjectCache = LRU<Buffer>(2048);

const openCounts: {
  [fileName: string]: {
    fd: number;
    count: number;
  };
} = {};

interface PackedIndex {
  offset: number;
  fileIndex: number;
}

interface PackedIndexDict {
  [hash: string]: PackedIndex;
}

interface PackedObject {
  type: ObjectTypeEnum;
  size: number;
  i: number;
}

function setupPackedIndexDict(idxFileBuffer: Buffer, fileIndex: number, dict: PackedIndexDict) {
  if (idxFileBuffer.readUInt32BE(0) !== 0xff744f63 || idxFileBuffer.readUInt32BE(4) !== 2) {
    throw new Error('only v2 pack index is supported.');
  }

  const n = idxFileBuffer.readUInt32BE(HASH_COUNT_POSITION);
  for (let i = 0; i < n; i++) {
    const hash = idxFileBuffer.slice(HASH_START_POSITION + i * 20, HASH_START_POSITION + (i + 1) * 20).toString('hex');
    const offset = idxFileBuffer.readUInt32BE(HASH_START_POSITION + n * 24 + i * 4);
    dict[hash] = { offset, fileIndex };
  }
}

export class Packs {
  constructor(
    public gitDir: string,
    public packFileNames: string[],
    public packedIndexDict: PackedIndexDict,
  ) { }

  static async create(gitDir: string) {
    const cache = packsCache.get(gitDir);
    if (cache) return cache;
    let s: string;
    try {
      s = (await readFileAsync(path.join(gitDir, 'objects', 'info', 'packs'), 'utf8')).trim() as string;
    } catch (e) {
      return;
    }
    const packedIndexDict: PackedIndexDict = {}; 
    const fileNames = s.split('\n').map(line => (line.match(/pack-[0-9a-f]{40}/) as string[])[0]);
    for (let i = 0; i < fileNames.length; i++) {
      const buff = await readFileAsync(path.join(gitDir, 'objects', 'pack', fileNames[i] + '.idx'));
      setupPackedIndexDict(buff, i, packedIndexDict);
    }
    return new Packs(gitDir, fileNames, packedIndexDict);
  }

  static createSync(gitDir: string) {

  }

  async unpackGitObject(hash: string): Promise<Buffer> {
    const idx = this.packedIndexDict[hash];
    const key = `${idx.fileIndex}:${idx.offset}`;
    let dst: Buffer;
    if (!idx) {
      throw new Error(`${hash} is not found.`);
    }
    dst = packedObjectCache.get(key);
    if (dst) {
      return dst;
    }
    const filePath = path.join(this.gitDir, 'objects', 'pack', this.packFileNames[idx.fileIndex] + '.pack');
    const fd = await openFileAsync(filePath, 'r');
    try {
      dst = await this._unpackGitObject(fd, idx);
    } catch (e) {
      // console.log(e.stack);
      throw e;
    } finally {
      await closeFileAsync(fd);
    }
    return dst;
  }

  async _unpackGitObject(fd: number, idx: PackedIndex): Promise<Buffer> {
    let dst: Buffer | null = null;
    const key = `${idx.fileIndex}:${idx.offset}`;
    dst = packedObjectCache.get(key);
    if (dst) {
      return dst;
    }
    const head = Buffer.alloc(32);
    await readAsync(fd, head, 0, 32, idx.offset);
    const po = this._initPackedObject(idx, head);
    switch (po.type) {
      case ObjectTypeEnum.COMMIT:
      case ObjectTypeEnum.TREE:
      case ObjectTypeEnum.BLOB:
      case ObjectTypeEnum.TAG: {
        const buff = Buffer.alloc(po.size * 2);
        await readAsync(fd, buff, 0, po.size, idx.offset + po.i);
        dst = await inflateAsync(buff);
        break;
      }
      case ObjectTypeEnum.REF_DELTA:
      case ObjectTypeEnum.OFS_DELTA:
        dst = await this._unpackDeltaObject(fd, idx, po, head);
        break;
    }
    if (!dst) {
      throw new Error(`${po.type} is not a invalid object type.`);
    }
    packedObjectCache.set(key, dst);    
    return dst;
  }

  private _initPackedObject(idx: PackedIndex, buff: Buffer): PackedObject {
    let c = buff[0];
    let type = (c >> 4) & 7;
    let size = (c & 15);
    let i = 1;
    let x = 16;
    while (c & 0x80) {
      c = buff[i++];
      size +=(c & 0x7f) * x;
      x *= 128;
    }
    return { type, size, i };
  }

  private _readOfsBaseOffset(po: PackedObject, head: Buffer) {
    let c = head[po.i++];
    let offset = 1;
    let baseOffset = c & 0x7f;
    while (c & 0x80) {
      baseOffset++;
      c = head[po.i++];
      baseOffset = baseOffset * 128 + (c & 0x7f);
    }
    return baseOffset;
  }

  private _readOfsDataSize(buff: Buffer, offset: number) {
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

  private async _unpackDeltaObject(fd: number, idx: PackedIndex, po: PackedObject, head: Buffer): Promise<Buffer> {
    if (po.type === ObjectTypeEnum.OFS_DELTA) {
      const baseOffset = this._readOfsBaseOffset(po, head);
      const src = await this._unpackGitObject(fd, {
        offset: idx.offset - baseOffset,
        fileIndex: idx.fileIndex
      });
      const delta = await this._getData(fd, idx, po);
      const dst = this._patchDelta(src, delta);
      return dst;
    } else {
      // TODO;
      return new Buffer(1);
    }
  }

  private async _getData(fd: number, idx: PackedIndex, po: PackedObject) {
    const buff = Buffer.alloc(po.size * 2);
    await readAsync(fd, buff, 0, buff.length, idx.offset + po.i);
    return await inflateAsync(buff);
  }

  private _patchDelta(src: Buffer, delta: Buffer) {
    let offset = 0;
    let srcSize;
    let dstSize;
    [srcSize, offset] = this._readOfsDataSize(delta, offset);
    [dstSize, offset] = this._readOfsDataSize(delta, offset);
    let dstOffset = 0;
    let cmd: number;
    const dst = Buffer.alloc(dstSize);
    while (offset < delta.length) {
      cmd = delta[offset++];
      if (cmd & 0x80) {
        let cpOff = 0;
        let cpSize = 0;
        if (cmd & 0x01) cpOff = delta[offset++];
        if (cmd & 0x02) cpOff |= (delta[offset++] << 8);
        if (cmd & 0x04) cpOff |= (delta[offset++] << 16);
        if (cmd & 0x08) cpOff |= (delta[offset++] << 24);
        if (cmd & 0x10) cpSize = delta[offset++];
        if (cmd & 0x20) cpSize |= (delta[offset++] << 8);
        if (cmd & 0x40) cpSize |= (delta[offset++] << 16);
        if (cpSize === 0) cpSize = 0x10000;
        dst.set(src.slice(cpOff, cpOff + cpSize), dstOffset);
        dstOffset += cpSize;
        dstSize -= cpSize;
      } else if (cmd) {
        if (cmd > dstSize) {
          break;
        }
        dst.set(delta.slice(offset, offset + cmd), dstOffset);
        dstOffset += cmd;
        offset += cmd;
        dstSize -= cmd;
      }
    }
    return dst;
  }
}
