import * as fs from 'fs';
import * as promisify from 'util.promisify';
import * as zlib from 'zlib';
import * as path from 'path';

const readFileAsync = promisify(fs.readFile);
const inflateAsync = promisify(zlib.inflate);

export class Commit {
  parentHashes: string[];
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
    return await readCommit(this.gitRoot, parentHash);
  }

  walkSync(parentHash = this.baseParentHash) {
    return readCommitSync(this.gitRoot, parentHash);
  }
}

function getObjectPath(gitRoot: string, hash: string) {
  return path.join(gitRoot, 'objects', hash.replace(/^(.{2})(.{38})$/, `$1${path.sep}$2`));
}

export async function readCommit(gitRoot: string, hash: string): Promise<Commit> {
  const deflatedData = await readFileAsync(getObjectPath(gitRoot, hash));
  const data = (await inflateAsync(deflatedData)).toString('utf8');
  return new Commit(gitRoot, hash, data);
}

export function readCommitSync(gitRoot: string, hash: string): Commit {
  const deflatedData = fs.readFileSync(getObjectPath(gitRoot, hash));
  const data = zlib.inflateSync(deflatedData).toString('utf8');
  return new Commit(gitRoot, hash, data);
}
