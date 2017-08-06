import * as fs from 'fs';
import * as promisify from 'util.promisify';
import * as path from 'path';
import { Commit } from './commit';
import { Packs } from "./pack";

const statAsync = promisify(fs.stat);
const readFileAsync = promisify(fs.readFile);
const readDirAsync = promisify(fs.readdir);

export type REFS_DIR = 'heads' | 'tags' | 'remotes';
export type BRANCH_DIR = 'heads' | 'remotes';

export type StringMap = Map<string, string>;
export type RefMap = Map<string, Ref>;

export class Ref {
  private _commit: Commit;

  constructor(
    readonly name: string,
    private _gitDir: string,
    private _hash: string,
    private _packs: Packs,
  ) { }

  get commit() {
    if (this._commit) {
      return this._commit;
    }
    return this._commit = Commit.readCommitSync(this._gitDir, this._hash, this._packs);
  }
}

export interface HEAD {
  readonly type: 'branch' | 'commit';
  readonly branch?: Ref;
  readonly commit?: Commit;
}

const processings: { [gitDir: string]: Promise<void> } = {};

export class Repository {
  private _refs: {
    heads: Ref[];
    tags: Ref[];
    remotes: Ref[];
  };
  private _refMaps = {} as {
    heads: RefMap;
    tags: RefMap;
    remotes: RefMap;
  };
  private _packs: Packs;
  private _refsDir: string;  

  constructor(readonly gitDir: string) {
    this._refsDir = path.join(gitDir, 'refs');
  }

  /**
   * Find a git directory. This function find one from current or parents directories.
   */
  static async findGitDir(repositoryPath = process.cwd()): Promise<string | undefined> {
    try {
      const gitDir = path.resolve(repositoryPath, '.git');
      const stat = await statAsync(gitDir);
      if (stat.isDirectory()) {
        return gitDir;
      } else if (stat.isFile()) {
        const gitDirRef = await readFileAsync(gitDir, 'utf8').trim().split(/\s/).pop() as string;
        return path.resolve(repositoryPath, gitDirRef);
      }
    } catch (err) {
      const parent = path.resolve(repositoryPath, '..');
      if (repositoryPath === parent) return;
      return await Repository.findGitDir(parent);
    }
  }

  /**
   * Find a git directory sync. This function find one from current or parents directories.
   */
  static findGitDirSync(repositoryPath = process.cwd()): string | undefined {
    try {
      const gitDir = path.resolve(repositoryPath, '.git');
      const stat = fs.statSync(gitDir);
      if (stat.isDirectory()) {
        return gitDir;
      } else if (stat.isFile()) {
        const gitDirRef = fs.readFileSync(gitDir, 'utf8').trim().split(/\s/).pop() as string;
        return path.resolve(repositoryPath, gitDirRef);
      }
    } catch (err) {
      const parent = path.resolve(repositoryPath, '..');
      if (repositoryPath === parent) return;
      return Repository.findGitDirSync(parent);
    }
  }

  private async _initRefs() {
    if (this._refs) {
      return;
    }
    if (processings[this.gitDir]) {
      return await processings[this.gitDir];
    }
    if (!this._packs) {
      this._packs = await Packs.initialize(this.gitDir);      
    }

    const createMap = async (dir: string, prefix = '') => {
      const map: StringMap = new Map();
      try {
        const names = await readDirAsync(path.join(this._refsDir, dir));
        for (let i = 0; i < names.length; i++) {
          const name = names[i];
          if (name === 'HEAD') continue;
          const hash = (await readFileAsync(path.join(this._refsDir, dir, name), 'utf8')).trim();
          map.set(prefix + name, hash); 
        }
      } catch (e) { }
      return map;
    };

    const readCommits = async (map: StringMap) => {
      const refs: Ref[] = [];
      for (const [name, hash] of map.entries()) {
        refs[refs.length] = new Ref(name, this.gitDir, hash, this._packs);
      }
      return refs;
    };

    const branchMap = await createMap('heads');
    const tagMap = await createMap('tags');
    const remoteBranchMap: StringMap = new Map();
    try {
      const dirs = await readDirAsync(path.join(this._refsDir, 'remotes'));
      for (let i = 0; i < dirs.length; i++) {
        const dir = dirs[i];
        const map = await createMap(path.join('remotes', dir), `${dir}/`);
        for (const [key, hash] of map.entries()) {
          remoteBranchMap.set(key, hash);
        }
      }
    } catch (e) { }

    try {
      const s = await readFileAsync(path.join(this.gitDir, 'packed-refs'), 'utf8');
      addInfoRefs(s, branchMap, tagMap, remoteBranchMap);
    } catch (e) { }

    const promise = Promise.all([
      readCommits(branchMap),
      readCommits(tagMap),
      readCommits(remoteBranchMap),
    ]).then(([heads, tags, remotes]) => {
      this._refs = { heads, tags, remotes };
      this._initRefMaps();
      delete processings[this.gitDir];
    });
    processings[this.gitDir] = promise;
    return await promise;
  }

  private _initRefsSync() {
    if (this._refs) {
      return;
    }
    if (!this._packs) {
      this._packs = Packs.initializeSync(this.gitDir);
    }

    const createMap = (dir: string, prefix = '') => {
      const map: StringMap = new Map();
      try {
        const names = fs.readdirSync(path.join(this._refsDir, dir));
        for (let i = 0; i < names.length; i++) {
          const name = names[i];
          if (name === 'HEAD') continue;
          const hash = fs.readFileSync(path.join(this._refsDir, dir, name), 'utf8').trim();
          map.set(prefix + name, hash); 
        }
      } catch (e) { }
      return map;
    };

    const readCommits = (map: StringMap) => {
      const refs: Ref[] = [];
      for (const [name, hash] of map.entries()) {
        refs[refs.length] = new Ref(name, this.gitDir, hash, this._packs);
      }
      return refs;
    };

    const branchMap = createMap('heads');
    const tagMap = createMap('tags');
    const remoteBranchMap: StringMap = new Map();
    try {
      const dirs = fs.readdirSync(path.join(this._refsDir, 'remotes'));
      for (let i = 0; i < dirs.length; i++) {
        const dir = dirs[i];
        const map = createMap(path.join('remotes', dir), `${dir}/`);
        for (const [key, hash] of map.entries()) {
          remoteBranchMap.set(key, hash);
        }
      }
    } catch (e) { }

    try {
      const s = fs.readFileSync(path.join(this.gitDir, 'packed-refs'), 'utf8');
      addInfoRefs(s, branchMap, tagMap, remoteBranchMap);
    } catch (e) { }

    this._refs = {
      heads: readCommits(branchMap),
      tags: readCommits(tagMap),
      remotes: readCommits(remoteBranchMap),
    };
    this._initRefMaps();
  }

  private _initRefMaps() {
    Object.keys(this._refs).forEach((k: REFS_DIR) => {
      const m = new Map();
      this._refs[k].forEach(ref => m.set(ref.name, ref));
      this._refMaps[k] = m;
    });
  }

  /**
   * Read a infomation of `.git/HEAD`.
   * 
   * ```ts
   * const head = repo.readHead();
   * // if type is 'branch'
   * console.log(head.type === 'branch');
   * console.log(head.branch);
   * // if type is 'commit'
   * console.log(head.type === 'commit);
   * console.log(head.branch);
   * ```
   */
  async readHead(): Promise<HEAD> {
    if (!this._packs) {
      this._packs = await Packs.initialize(this.gitDir);      
    }

    const s = (await readFileAsync(path.join(this.gitDir, 'HEAD'), 'utf8')).trim();
    if (s.startsWith('ref')) {
      const name = s.split('/').pop() as string;
      return {
        type: 'branch',
        branch: await this._readRef('heads', name),
      };
    } else {
      return {
        type: 'commit',
        commit: await Commit.readCommit(this.gitDir, s, this._packs),
      };
    }
  }

  /**
   * Read a infomation of `.git/HEAD` sync.
   */
  readHeadSync(): HEAD {
    if (!this._packs) {
      this._packs = Packs.initializeSync(this.gitDir);      
    }

    const s = fs.readFileSync(path.join(this.gitDir, 'HEAD'), 'utf8').trim();
    if (s.startsWith('ref')) {
      const name = s.split('/').pop() as string;
      return {
        type: 'branch',
        branch: this._readRefSync('heads', name),
      };
    } else {
      return {
        type: 'commit',
        commit: Commit.readCommitSync(this.gitDir, s, this._packs),
      };
    }
  }

  private async _readRefs(dir: REFS_DIR): Promise<Ref[]> {
    if (!this._refs) await this._initRefs();
    return this._refs[dir];
  }

  private _readRefsSync(dir: REFS_DIR): Ref[] {
    if (!this._refs) this._initRefsSync();
    return this._refs[dir];
  }

  private _findRef(dir: REFS_DIR, name: string) {
    const ref = this._refMaps[dir].get(name);
    if (!ref) throw new Error(`refs/${dir}/${name} is not found.`);
    return ref;
  }

  private async _readRef(dir: REFS_DIR, name: string): Promise<Ref> {
    if (!this._refs) await this._initRefs();
    return this._findRef(dir, name);
  }

  private _readRefSync(dir: REFS_DIR, name: string): Ref {
    if (!this._refs) this._initRefsSync();
    return this._findRef(dir, name);
  }

  /**
   * Read branches.
   * 
   * ```ts
   * const heads = await repo.readBranches(); // or await repo.readBranches('heads');
   * const remotes = await repo.readBranches('remotes');
   * const allBranches = await repo.readBranches(['heads', 'remotes']);
   * console.log(heads[0].name, heads[0].commit);
   * ```
   */
  async readBranches(dirs: BRANCH_DIR[] | BRANCH_DIR = ['heads']): Promise<Ref[]> {
    if (!Array.isArray(dirs)) {
      dirs = [dirs];
    }
    return await Promise
      .all(dirs.map(async dir => await this._readRefs(dir)))
      .then(results => Array.prototype.concat.apply([], results));
  }

  /**
   * Read branches sync.
   */
  readBranchesSync(dirs: BRANCH_DIR[] | BRANCH_DIR = ['heads']): Ref[] {
    if (!Array.isArray(dirs)) {
      dirs = [dirs];
    }
    return Array.prototype.concat.apply([], dirs.map(dir => this._readRefsSync(dir)));

  }

  /**
   * Read a commit by branch name.
   * 
   * ```ts
   * const masterCommit = await repo.readCommitByBranch('master');
   * const originMasterCommit = await repo.readCommitByBranch('origin/master');
   * ```
   */
  async readCommitByBranch(branchName: string): Promise<Commit> {
    try {
      return (await this._readRef('heads', branchName)).commit;
    } catch (e) {
      return (await this._readRef('remotes', branchName)).commit;
    }
  }

  /**
   * Read a commit by branch name sync.
   */
  readCommitByBranchSync(branchName: string): Commit {
    try {
      return this._readRefSync('heads', branchName).commit;
    } catch (e) {
      return this._readRefSync('remotes', branchName).commit;
    }
  }

  /**
   * Read tags.
   * 
   * ```ts
   * const tags = await repo.readTags();
   * ```
   */
  async readTags(): Promise<Ref[]> {
    return await this._readRefs('tags');
  }

  /**
   * Read tags sync.
   */
  readTagsSync(): Ref[] {
    return this._readRefsSync('tags');
  }

  /**
   * Read a commit by tag name.
   * 
   * ```ts
   * const commit = repo.readCommitByTag('v1.0');
   * ```
   */
  async readCommitByTag(tagName: string): Promise<Commit> {
    return (await this._readRef('tags', tagName)).commit;
  }

  /**
   * Read a commit by tag name sync.
   */
  readCommitByTagSync(tagName: string): Commit {
    return this._readRefSync('tags', tagName).commit;
  }
}

function addInfoRefs(s: string, branchMap: StringMap, tagMap: StringMap, remoteBranchMap: StringMap) {
  const _tagMap: StringMap = new Map();
  const lines = s.trim().split('\n').forEach((line: string) => {
    const m = line.match(/([a-f\d]{40}) refs\/(heads|remotes|tags)\/(.+)/);
    console.log(m, line);
    if (!m) return;
    const [, hash, type, name] = m;
    switch (type) {
      case 'heads': !branchMap.has(name) && branchMap.set(name, hash); break;
      case 'remotes': !remoteBranchMap.has(name) && remoteBranchMap.set(name, hash); break;
      case 'tags': !tagMap.has(name) && tagMap.set(name, hash); break;
    }
  });
}
