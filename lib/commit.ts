import * as fs from 'fs';
import * as promisify from 'util.promisify';
import * as zlib from 'zlib';
import * as path from 'path';
import { Packs } from './pack';

const readFileAsync = promisify(fs.readFile);
const inflateAsync = promisify(zlib.inflate);

export class Commit {
  parentHashes: string[];
  type: string;
  size: number;
  body: string;
  packs: Packs;

  constructor(
    private gitDir: string,
    readonly hash: string,
    private data: string,
  ) {
    const [head, ...rest] = data.split('\u0000');
    const [type, size] = head.split(/\s/);
    this.size = +size;
    this.body = rest.join('\u0000');
    const m = this.body.match(/^parent\s[a-f0-9]{40}/gm);
    this.parentHashes = m ? m.map(s => s.split(/\s/).pop()) as string[] : [];
  }

  get hasParents() {
    return !!this.parentHashes.length;
  }

  get isMergeCommit() {
    return this.parentHashes.length >= 2;
  }

  get baseParentHash() {
    return this.parentHashes[0];
  }

  get mergedParentHashes() {
    return this.parentHashes.slice(1);
  }
  
  async walk(parentHash = this.baseParentHash) {
    return await Commit.readCommit(this.gitDir, parentHash);
  }

  walkSync(parentHash = this.baseParentHash) {
    return Commit.readCommitSync(this.gitDir, parentHash);
  }

  static async readCommit(gitDir: string, hash: string): Promise<Commit> {
    const packs = await Packs.create(gitDir);
    if (packs) {
      const body = await packs.unpackGitObject(hash);
      if (body) {
        const data = `commit ${body.length}\u0000${body.toString('utf8')}`;
        return new Commit(gitDir, hash, data);
      }
    }
    const deflatedData = await readFileAsync(getObjectPath(gitDir, hash));
    const data = (await inflateAsync(deflatedData)).toString('utf8');
    return new Commit(gitDir, hash, data);
  }

  static readCommitSync(gitDir: string, hash: string): Commit {
    const deflatedData = fs.readFileSync(getObjectPath(gitDir, hash));
    const data = zlib.inflateSync(deflatedData).toString('utf8');
    return new Commit(gitDir, hash, data);
  }
}

function getObjectPath(gitDir: string, hash: string) {
  return path.join(gitDir, 'objects', hash.replace(/^(.{2})(.{38})$/, `$1${path.sep}$2`));
}
