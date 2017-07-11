import * as fs from 'fs';
import * as util from 'util';
import * as zlib from 'zlib';

const readFileAsync = util.promisify(fs.readFile);
const inflateAsync = util.promisify(zlib.inflate);

export class Commit {
  parentHashs: string[];
  type: string;
  size: number;
  body: string;

  constructor(
    private gitRoot: string,
    readonly hash: string,
    private data: string,
  ) {
    const [head, ...rest] = data.split('\u0000');
    const [type, size] = head.split(/\s/);
    this.size = +size;
    this.body = rest.join('\u0000');
    const m = this.body.match(/^parent\s[a-f0-9]{40}/gm);
    this.parentHashs = m ? m.map(s => s.split(/\s/).pop()) as string[] : [];
  }

  get hasParents() {
    return !!this.parentHashs.length;
  }

  get isMergeCommit() {
    return this.parentHashs.length >= 2;
  }

  get baseParentHash() {
    return this.parentHashs[0];
  }

  get mergedParents() {
    return this.parentHashs.slice(1);
  }
  
  async walk(parentHash = this.baseParentHash) {
    return await readCommit(this.gitRoot, parentHash);
  }

  walkSync(parentHash = this.baseParentHash) {
    return readCommitSync(this.gitRoot, parentHash);
  }
}

export async function readCommit(gitRoot: string, hash: string): Promise<Commit> {
  const deflatedData = await readFileAsync(`${gitRoot}/objects/${hash.replace(/^(.{2})(.{38})$/, '$1/$2')}`);
  const data = (await inflateAsync(deflatedData)).toString('utf8');
  return new Commit(gitRoot, hash, data);
}

export function readCommitSync(gitRoot: string, hash: string): Commit {
  const deflatedData = fs.readFileSync(`${gitRoot}/objects/${hash.replace(/^(.{2})(.{38})$/, '$1/$2')}`);
  const data = zlib.inflateSync(deflatedData).toString('utf8');
  return new Commit(gitRoot, hash, data);
}
