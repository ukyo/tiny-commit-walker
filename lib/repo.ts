import * as fs from 'fs';
import * as promisify from 'util.promisify';
import * as path from 'path';
import { Commit, readCommit, readCommitSync } from './commit';

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
  gitRoot: string;

  constructor(repositoryPath: string) {
    this.gitRoot = path.join(repositoryPath, '.git');
    try {
      const stat = fs.statSync(this.gitRoot);
      if (stat.isFile()) {
        this.gitRoot = fs.readFileSync(this.gitRoot, 'utf8').split(/\s/).pop() as string;
      }
    } catch (err) { }
  }

  async readHead(): Promise<HEAD> {
    const s = (await readFileAsync(path.join(this.gitRoot, 'HEAD'), 'utf8')).trim();
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
        commit: await readCommit(this.gitRoot, s),
      };
    }
  }

  readHeadSync(): HEAD {
    const s = fs.readFileSync(path.join(this.gitRoot, 'HEAD'), 'utf8').trim();
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
        commit: readCommitSync(this.gitRoot, s),
      };
    }
  }

  private async _readBranchesOrTags(dir: string): Promise<(Tag | Branch)[]> {
    const names: string[] = await readDirAsync(path.join(this.gitRoot, 'refs', dir));
    return await Promise.all(names.map(async name => {
      return {
        name,
        commit: await this._readCommitByBranchOrTag(dir, name),
      };
    }));
  }

  private _readBranchesOrTagsSync(dir: string): (Tag | Branch)[] {
    const names = fs.readdirSync(path.join(this.gitRoot, 'refs', dir));
    return names.map(name => {
      return {
        name,
        commit: this._readCommitByBranchOrTagSync(dir, name),
      }
    });
  }

  private async _readCommitByBranchOrTag(dir: string, name: string): Promise<Commit> {
    const hash = (await readFileAsync(path.join(this.gitRoot, 'refs', dir, name), 'utf8')).trim();
    return await readCommit(this.gitRoot, hash);
  }

  private _readCommitByBranchOrTagSync(dir: string, name: string): Commit {
    const hash = fs.readFileSync(path.join(this.gitRoot, 'refs', dir, name), 'utf8').trim();
    return readCommitSync(this.gitRoot, hash);
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
