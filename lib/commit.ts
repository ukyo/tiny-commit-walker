import * as fs from 'fs';
import * as promisify from 'util.promisify';
import * as zlib from 'zlib';
import * as path from 'path';
import { Packs } from './pack';

const readFileAsync = promisify(fs.readFile);
const inflateAsync = promisify(zlib.inflate);

export class Commit {
  readonly parentHashes: string[];
  readonly type: string;
  readonly size: number;
  readonly body: string;

  constructor(
    readonly gitDir: string,
    readonly hash: string,
    readonly data: string,
    private _packs?: Packs,
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
  
  /**
   * Get parent commit by a parent hash.
   * 
   * ```ts
   * // default is the baseParentHash.
   * let parentCommit = await commit.walk();
   * 
   * // or set a parent hash manually.
   * parentCommit = await commit.walk(commit.parentHash[1]);
   * ```
   */
  async walk(parentHash = this.baseParentHash) {
    return await Commit.readCommit(this.gitDir, parentHash, this._packs);
  }

  /**
   * Get parent commit by a parent hash sync.
   * 
   * ```ts
   * let parentCommit = commit.walkSync();
   * parentCommit = commit.walkSync(commit.parentHash[1]);
   * ```
   */
  walkSync(parentHash = this.baseParentHash) {
    return Commit.readCommitSync(this.gitDir, parentHash, this._packs);
  }

  static async readCommit(gitDir: string, hash: string, packs?: Packs): Promise<Commit> {
    if (packs && packs.hasPackFiles) {
      try {
        const body = await packs.unpackGitObject(hash);
        const s = body.toString('utf8');
        if (s.startsWith('object')) {
          return await Commit.readCommit(gitDir, (s.match(/[a-f0-9]{40}/) as string[])[0], packs);
        }
        const data = `commit ${body.length}\u0000${body.toString('utf8')}`;
        return new Commit(gitDir, hash, data, packs);
      } catch (e) { }
    }
    const deflatedData = await readFileAsync(getObjectPath(gitDir, hash));
    const data = (await inflateAsync(deflatedData)).toString('utf8');
    if (data.startsWith('tag')) {
      return await Commit.readCommit(gitDir, (data.match(/[a-f0-9]{40}/) as string[])[0], packs);
    }
    return new Commit(gitDir, hash, data, packs);
  }

  static readCommitSync(gitDir: string, hash: string, packs?: Packs): Commit {
    if (packs && packs.hasPackFiles) {
      try {
        const body = packs.unpackGitObjectSync(hash);
        const s = body.toString('utf8');
        if (s.startsWith('object')) {
          return Commit.readCommitSync(gitDir, (s.match(/[a-f0-9]{40}/) as string[])[0], packs);
        }
        const data = `commit ${body.length}\u0000${body.toString('utf8')}`;
        return new Commit(gitDir, hash, data, packs);
      } catch (e) { }
    }
    const deflatedData = fs.readFileSync(getObjectPath(gitDir, hash));
    const data = zlib.inflateSync(deflatedData).toString('utf8');
    if (data.startsWith('tag')) {
      return Commit.readCommitSync(gitDir, (data.match(/[a-f0-9]{40}/) as string[])[0], packs);
    }
    return new Commit(gitDir, hash, data, packs);
  }
}

function getObjectPath(gitDir: string, hash: string) {
  return path.join(gitDir, 'objects', hash.replace(/^(.{2})(.{38})$/, `$1${path.sep}$2`));
}
