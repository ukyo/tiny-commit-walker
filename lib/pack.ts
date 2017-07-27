import * as LRU from 'lru-cache';
import * as fs from 'fs';
import * as promisify from 'util.promisify';
import * as path from 'path';
import * as zlib from 'zlib';
import { Commit } from './commit';
import { patchDelta, readBaseOffset } from "./delta";


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

export interface PackedIndex {
  offset: number;
  fileIndex: number;
}

export type PackedIndexMap = Map<string, PackedIndex>;

class PackedObject {
  readonly type: ObjectTypeEnum;
  readonly size: number;
  offset: number;

  constructor(idx: PackedIndex, buff: Buffer) {
    let c = buff[0];
    let type = (c >> 4) & 7;
    let size = (c & 15);
    let offset = 1;
    let x = 16;
    while (c & 0x80) {
      c = buff[offset++];
      size +=(c & 0x7f) * x;
      x *= 128;
    }
    this.type = type;
    this.size = size;
    this.offset = offset;
  }
}

function setupPackedIndexMap(idxFileBuffer: Buffer, fileIndex: number, map: PackedIndexMap) {
  if (idxFileBuffer.readUInt32BE(0) !== 0xff744f63 || idxFileBuffer.readUInt32BE(4) !== 2) {
    throw new Error('Only v2 pack-*.idx files are supported.');
  }

  const n = idxFileBuffer.readUInt32BE(HASH_COUNT_POSITION);
  for (let i = 0; i < n; i++) {
    const hash = idxFileBuffer.slice(HASH_START_POSITION + i * 20, HASH_START_POSITION + (i + 1) * 20).toString('hex');
    const offset = idxFileBuffer.readUInt32BE(HASH_START_POSITION + n * 24 + i * 4);
    map.set(hash, { offset, fileIndex });
  }
}

const processings: { [gitDir: string]: Promise<Packs> } = {};

export class Packs {
  readonly hasPackFiles: boolean;

  constructor(
    readonly packDir: string,
    readonly packFileNames: string[] = [],
    readonly packedIndexMap: PackedIndexMap = new Map(),
  ) {
    this.hasPackFiles = !!this.packFileNames.length;
  }

  static async initialize(gitDir: string): Promise<Packs> {
    const packs = packsCache.get(gitDir);
    if (packs) return packs;
    if (processings[gitDir]) return processings[gitDir];
    const promise = this._initialize(gitDir);
    processings[gitDir] = promise;
    return await promise.then(packs => {
      delete processings[gitDir];
      packs && packsCache.set(gitDir, packs);
      return packs;
    });
  }

  static async _initialize(gitDir: string): Promise<Packs> {
    const packDir = path.join(gitDir, 'objects', 'pack');
    let fileNames: string[];
    try {
      fileNames = (await readDirAsync(packDir) as string[])
        .filter(name => /\.idx$/.test(name))
        .map(name => name.split(".").shift() as string);
    } catch (e) {
      return new Packs(gitDir);
    }
    if (!fileNames.length) {
      return new Packs(gitDir);
    }
    const packedIndexMap: PackedIndexMap = new Map();
    for (let i = 0; i < fileNames.length; i++) {
      const buff = await readFileAsync(path.join(packDir, fileNames[i] + ".idx"));
      setupPackedIndexMap(buff, i, packedIndexMap);
    }
    return new Packs(packDir, fileNames, packedIndexMap);
  }

  static initializeSync(gitDir: string): Packs {
    let packs = packsCache.get(gitDir);
    if (packs) {
      return packs;
    }
    const packDir = path.join(gitDir, 'objects', 'pack');
    let fileNames: string[];
    try {
      fileNames = (fs.readdirSync(packDir) as string[])
        .filter(name => /\.idx$/.test(name))
        .map(name => name.split(".").shift() as string);
    } catch (e) {
      packs = new Packs(gitDir);
      packsCache.set(gitDir, packs);
      return packs;
    }
    if (!fileNames.length) {
      packs = new Packs(gitDir);
      packsCache.set(gitDir, packs);
      return packs;
    }
    const packedIndexMap: PackedIndexMap = new Map();
    for (let i = 0; i < fileNames.length; i++) {
      const buff = fs.readFileSync(path.join(packDir, fileNames[i] + ".idx"));
      setupPackedIndexMap(buff, i, packedIndexMap);
    }
    packs = new Packs(packDir, fileNames, packedIndexMap);
    packsCache.set(gitDir, packs);
    return packs;
  }

  async unpackGitObject(hash: string): Promise<Buffer> {
    const idx = this.packedIndexMap.get(hash);
    if (!idx) {
      throw new Error(`${hash} is not found.`);
    }
    const key = `${idx.fileIndex}:${idx.offset}`;
    let dst: Buffer = packedObjectCache.get(key);
    if (dst) {
      return dst;
    }
    const filePath = path.join(this.packDir, this.packFileNames[idx.fileIndex] + '.pack');
    const fd = await openFileAsync(filePath, 'r');
    try {
      dst = await this._unpackGitObject(fd, idx);
    } catch (e) {
      throw e;
    } finally {
      await closeFileAsync(fd);
    }
    return dst;
  }

  unpackGitObjectSync(hash: string): Buffer {
    const idx = this.packedIndexMap.get(hash);
    if (!idx) {
      throw new Error(`${hash} is not found.`);
    }
    const key = `${idx.fileIndex}:${idx.offset}`;
    let dst: Buffer;
    dst = packedObjectCache.get(key);
    if (dst) {
      return dst;
    }
    const filePath = path.join(this.packDir, this.packFileNames[idx.fileIndex] + '.pack');
    const fd = fs.openSync(filePath, 'r');
    try {
      dst = this._unpackGitObjectSync(fd, idx);
    } catch (e) {
      throw e;
    } finally {
      fs.closeSync(fd);
    }
    return dst;
  }

  private async _unpackGitObject(fd: number, idx: PackedIndex): Promise<Buffer> {
    let dst: Buffer;
    const key = `${idx.fileIndex}:${idx.offset}`;
    dst = packedObjectCache.get(key);
    if (dst) {
      return dst;
    }
    const head = Buffer.alloc(32);
    await readAsync(fd, head, 0, 32, idx.offset);
    const po = new PackedObject(idx, head);
    switch (po.type) {
      case ObjectTypeEnum.COMMIT:
      case ObjectTypeEnum.TREE:
      case ObjectTypeEnum.BLOB:
      case ObjectTypeEnum.TAG: {
        const buff = Buffer.alloc(po.size * 2 + 32);
        await readAsync(fd, buff, 0, buff.length, idx.offset + po.offset);
        dst = await inflateAsync(buff);
        break;
      }
      case ObjectTypeEnum.OFS_DELTA:
      case ObjectTypeEnum.REF_DELTA:
        dst = await this._unpackDeltaObject(fd, idx, po, head);
        break;
    }
    if (!dst) {
      throw new Error(`${po.type} is a invalid object type.`);
    }
    packedObjectCache.set(key, dst);    
    return dst;
  }

  private _unpackGitObjectSync(fd: number, idx: PackedIndex): Buffer {
    let dst: Buffer;
    const key = `${idx.fileIndex}:${idx.offset}`;
    dst = packedObjectCache.get(key);
    if (dst) {
      return dst;
    }
    const head = Buffer.alloc(32);
    fs.readSync(fd, head, 0, 32, idx.offset);
    const po = new PackedObject(idx, head);
    switch (po.type) {
      case ObjectTypeEnum.COMMIT:
      case ObjectTypeEnum.TREE:
      case ObjectTypeEnum.BLOB:
      case ObjectTypeEnum.TAG: {
        const buff = Buffer.alloc(po.size * 2 + 32);
        fs.readSync(fd, buff, 0, buff.length, idx.offset + po.offset);
        dst = zlib.inflateSync(buff);
        break;
      }
      case ObjectTypeEnum.OFS_DELTA:
      case ObjectTypeEnum.REF_DELTA:
        dst = this._unpackDeltaObjectSync(fd, idx, po, head);
        break;
    }
    if (!dst) {
      throw new Error(`${po.type} is a invalid object type.`);
    }
    packedObjectCache.set(key, dst);
    return dst;
  }

  private async _unpackDeltaObject(fd: number, idx: PackedIndex, po: PackedObject, head: Buffer): Promise<Buffer> {
    let src: Buffer;
    if (po.type === ObjectTypeEnum.OFS_DELTA) {
      const [baseOffset, offset] = readBaseOffset(head, po.offset);
      po.offset = offset;
      src = await this._unpackGitObject(fd, {
        offset: idx.offset - baseOffset,
        fileIndex: idx.fileIndex
      });
    } else {
      const hash = head.slice(po.offset, po.offset += 20).toString('hex');
      src = await this.unpackGitObject(hash) as Buffer;
    }
    const buff = Buffer.alloc(po.size * 2 + 32);
    await readAsync(fd, buff, 0, buff.length, idx.offset + po.offset);
    const delta = await inflateAsync(buff);
    const dst = patchDelta(src, delta);
    return dst;
  }

  private _unpackDeltaObjectSync(fd: number, idx: PackedIndex, po: PackedObject, head: Buffer): Buffer {
    let src: Buffer;
    if (po.type === ObjectTypeEnum.OFS_DELTA) {
      const [baseOffset, offset] = readBaseOffset(head, po.offset);
      po.offset = offset;
      src = this._unpackGitObjectSync(fd, {
        offset: idx.offset - baseOffset,
        fileIndex: idx.fileIndex
      });
    } else {
      const hash = head.slice(po.offset, po.offset += 20).toString('hex');
      src = this.unpackGitObjectSync(hash);
    }
    const buff = Buffer.alloc(po.size * 2 + 32);
    fs.readSync(fd, buff, 0, buff.length, idx.offset + po.offset);
    const delta = zlib.inflateSync(buff);
    const dst = patchDelta(src, delta);
    return dst;
  }
}
