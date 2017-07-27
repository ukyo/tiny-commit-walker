import * as fs from 'fs';
import * as promisify from 'util.promisify';
import * as path from 'path';
import { Commit } from './commit';
import { Packs } from "./pack";

const statAsync = promisify(fs.stat);
const readFileAsync = promisify(fs.readFile);
const readDirAsync = promisify(fs.readdir);

export type REFS_DIR = 'heads' | 'tags' | 'remotes';

export type StringMap = Map<string, string>;

export interface Branch {
  name: string;
  commit: Commit;
}

export interface Tag {
  name: string;
  commit: Commit;
}

export interface HEAD {
  type: 'branch' | 'commit';
  branch?: Branch;
  commit?: Commit;
}

const processings: { [gitDir: string]: Promise<void> } = {};

export class Repository {
  private _refs: {
    heads: Branch[];
    tags: Tag[];
    remotes: Branch[];
  };
  private _packs: Packs;

  constructor(readonly gitDir: string) { }

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

    const createMap = async (dir: REFS_DIR, prefix = '') => {
      const map: StringMap = new Map();
      try {
        const names = await readDirAsync(path.join(this.gitDir, 'refs', dir));
        for (let i = 0; i < names.length; i++) {
          const name = names[i];
          if (name === 'HEAD') continue;
          const hash = (await readFileAsync(path.join(this.gitDir, 'refs', dir, name), 'utf8')).trim();
          map.set(prefix + name, hash); 
        }
      } catch (e) { }
      return map;
    };

    const readCommits = async (map: StringMap) => {
      const brachOrTags: Branch[] | Tag[] = [];
      for (const [name, hash] of map.entries()) {
        brachOrTags[brachOrTags.length] = {
          name,
          commit: await Commit.readCommit(this.gitDir, hash, this._packs)
        };
      }
      return brachOrTags;
    };

    const branchMap = await createMap('heads');
    const tagMap = await createMap('tags');
    const remoteBranchMap: StringMap = new Map();
    try {
      const dirs = await readDirAsync(path.join(this.gitDir, 'refs', 'remotes'));
      for (let i = 0; i < dirs.length; i++) {
        const dir = dirs[i];
        const map = await createMap(path.join('remotes', dir), `${dir}/`);
        for (const [key, hash] of map.entries()) {
          remoteBranchMap.set(key, hash);
        }
      }
    } catch (e) {

    }

    try {
      const s = await readFileAsync(path.join(this.gitDir, 'info', 'refs'), 'utf8');
      addInfoRefs(s, branchMap, tagMap, remoteBranchMap);
    } catch (e) { }

    const promise = Promise.all([
      readCommits(branchMap),
      readCommits(tagMap),
      readCommits(remoteBranchMap),
    ]).then(([heads, tags, remotes]) => {
      this._refs = { heads, tags, remotes };
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

    const createMap = (dir: REFS_DIR) => {
      const map: StringMap = new Map();
      try {
        const names = fs.readdirSync(path.join(this.gitDir, 'refs', dir));
        for (let i = 0; i < names.length; i++) {
          const name = names[i];
          const hash = fs.readFileSync(path.join(this.gitDir, 'refs', dir, name), 'utf8').trim();
          map.set(name, hash); 
        }
      } catch (e) { }
      return map;
    };

    const readCommits = (map: StringMap) => {
      const brachOrTags: Branch[] | Tag[] = [];
      for (const [name, hash] of map.entries()) {
        brachOrTags[brachOrTags.length] = {
          name,
          commit: Commit.readCommitSync(this.gitDir, hash, this._packs)
        }
      }
      return brachOrTags;
    };

    const branchMap = createMap('heads');
    const tagMap = createMap('tags');

    try {
      const s = fs.readFileSync(path.join(this.gitDir, 'info', 'refs'), 'utf8');
      addInfoRefs(s, branchMap, tagMap, new Map());
    } catch (e) { }

    this._refs = {
      heads: readCommits(branchMap),
      tags: readCommits(tagMap),
      remotes: [],
    };
  }

  async readHead(): Promise<HEAD> {
    if (!this._packs) {
      this._packs = await Packs.initialize(this.gitDir);      
    }

    const s = (await readFileAsync(path.join(this.gitDir, 'HEAD'), 'utf8')).trim();
    if (s.startsWith('ref')) {
      const name = s.split(path.sep).pop() as string;
      return {
        type: 'branch',
        branch: {
          name,
          commit: await this.readCommitByBranch(name),
        }
      };
    } else {
      return {
        type: 'commit',
        commit: await Commit.readCommit(this.gitDir, s, this._packs),
      };
    }
  }

  readHeadSync(): HEAD {
    if (!this._packs) {
      this._packs = Packs.initializeSync(this.gitDir);      
    }

    const s = fs.readFileSync(path.join(this.gitDir, 'HEAD'), 'utf8').trim();
    if (s.startsWith('ref')) {
      const name = s.split(path.sep).pop() as string;
      return {
        type: 'branch',
        branch: {
          name,
          commit: this.readCommitByBranchSync(name),
        }
      };
    } else {
      return {
        type: 'commit',
        commit: Commit.readCommitSync(this.gitDir, s, this._packs),
      };
    }
  }

  private async _readBranchesOrTags(dir: REFS_DIR): Promise<(Tag | Branch)[]> {
    if (!this._refs) await this._initRefs();
    return this._refs[dir];
  }

  private _readBranchesOrTagsSync(dir: REFS_DIR): (Tag | Branch)[] {
    if (!this._refs) this._initRefsSync();
    return this._refs[dir];
  }

  private _findCommitFromRefs(dir: REFS_DIR, name: string) {
    const branchOrTag = this._refs[dir].find(o => o.name === name);
    if (!branchOrTag) throw new Error(`refs/${dir}/${name} is not found.`);
    return branchOrTag.commit;
  }

  private async _readCommitByBranchOrTag(dir: REFS_DIR, name: string): Promise<Commit> {
    if (!this._refs) await this._initRefs();
    return this._findCommitFromRefs(dir, name);
  }

  private _readCommitByBranchOrTagSync(dir: REFS_DIR, name: string): Commit {
    if (!this._refs) this._initRefsSync();
    return this._findCommitFromRefs(dir, name);
  }

  async readBranches(): Promise<Branch[]> {
    return await this._readBranchesOrTags('heads');
  }

  readBranchesSync(): Branch[] {
    return this._readBranchesOrTagsSync('heads');
  }

  async readCommitByBranch(branchName: string): Promise<Commit> {
    return await this._readCommitByBranchOrTag('heads', branchName);
  }

  readCommitByBranchSync(branchName: string): Commit {
    return this._readCommitByBranchOrTagSync('heads', branchName);
  }

  async readTags(): Promise<Tag[]> {
    return await this._readBranchesOrTags('tags');
  }

  readTagsSync(): Tag[] {
    return this._readBranchesOrTagsSync('tags');
  }

  async readCommitByTag(tagName: string): Promise<Commit> {
    return this._readCommitByBranchOrTag('tags', tagName);
  }

  readCommitByTagSync(tagName: string): Commit {
    return this._readCommitByBranchOrTagSync('tags', tagName);
  }
}

function addInfoRefs(s: string, branchMap: StringMap, tagMap: StringMap, remoteBranchMap: StringMap) {
  const _tagMap: StringMap = new Map();
  const lines = s.trim().split('\n').forEach((line: string) => {
    const [hash, ref] = line.split(/\s+/);
    let name = ref.split('/').pop() as string;
    if (/^refs\/heads\//.test(ref)) {
      if (branchMap.has(name)) return;
      branchMap.set(name, hash);
    } else if (/^refs\/remotes\//.test(ref)) {
      name = ref.slice('refs/remotes/'.length);
      if (remoteBranchMap.has(name) || name === 'HEAD') return;
      remoteBranchMap.set(name, hash);
    } else {
      if (name.endsWith('^{}')) {
        name = name.slice(0, -3);
      }
      _tagMap.set(name, hash);
    }
  });
  for (const [name, hash] of _tagMap.entries()) {
    if (!tagMap.has(name)) tagMap.set(name, hash);
  }
}
