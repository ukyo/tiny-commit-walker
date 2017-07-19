import * as fs from 'fs';
import * as promisify from 'util.promisify';
import * as path from 'path';
import { Commit } from './commit';

const statAsync = promisify(fs.stat);
const readFileAsync = promisify(fs.readFile);
const readDirAsync = promisify(fs.readdir);

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

export class Repository {
  private _refs: {
    heads: Branch[];
    tags: Tag[];
  };

  constructor(public gitDir: string) { }

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
    const createDict = async (dir: 'heads' | 'tags') => {
      const dict: { [name: string]: string } = {};
      const names = await readDirAsync(path.join(this.gitDir, 'refs', dir));
      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        const hash = (await readFileAsync(path.join(this.gitDir, 'refs', dir, name), 'utf8')).trim();
        dict[name] = hash; 
      }
      return dict;
    };

    const readCommits = async (dict: { [name: string]: string }) => {
      return await Promise.all(Object.keys(dict).map(async name => {
        return {
          name,
          commit: await Commit.readCommit(this.gitDir, dict[name])
        };
      }));
    };

    const branchDict = await createDict('heads');
    const tagDict = await createDict('tags');

    try {
      const s = await readFileAsync(path.join(this.gitDir, 'info', 'refs'), 'utf8');
      const lines = s.trim().split('\n').forEach((line: string) => {
        const [hash, ref] = line.split(/\s+/);
        const name = ref.split('/').pop() as string;
        if (/^refs\/heads\//.test(ref)) {
          if (branchDict[name]) return;
          branchDict[name] = hash;
        } else {
          if (tagDict[name]) return;
          tagDict[name] = hash;
        }
      });
    } catch (e) { }

    this._refs = {
      heads: await readCommits(branchDict),
      tags: await readCommits(tagDict),
    };
  }

  async readHead(): Promise<HEAD> {
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
        commit: await Commit.readCommit(this.gitDir, s),
      };
    }
  }

  readHeadSync(): HEAD {
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
        commit: Commit.readCommitSync(this.gitDir, s),
      };
    }
  }

  private async _readBranchesOrTags(dir: 'heads' | 'tags'): Promise<(Tag | Branch)[]> {
    if (!this._refs) await this._initRefs();
    return this._refs[dir];
  }

  private _readBranchesOrTagsSync(dir: string): (Tag | Branch)[] {
    const names = fs.readdirSync(path.join(this.gitDir, 'refs', dir));
    return names.map(name => {
      return {
        name,
        commit: this._readCommitByBranchOrTagSync(dir, name),
      }
    });
  }

  private async _readCommitByBranchOrTag(dir: 'heads' | 'tags', name: string): Promise<Commit> {
    if (!this._refs) await this._initRefs();
    const branchOrTag = this._refs[dir].find(o => o.name === name);
    if (!branchOrTag) throw new Error(`refs/${dir}/${name} is not found. ${JSON.stringify(this._refs)}`);
    return branchOrTag.commit;
  }

  private _readCommitByBranchOrTagSync(dir: string, name: string): Commit {
    const hash = fs.readFileSync(path.join(this.gitDir, 'refs', dir, name), 'utf8').trim();
    return Commit.readCommitSync(this.gitDir, hash);
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
