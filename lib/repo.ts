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

  private async _readBranchesOrTags(dir: string): Promise<(Tag | Branch)[]> {
    const names: string[] = await readDirAsync(path.join(this.gitDir, 'refs', dir));
    return await Promise.all(names.map(async name => {
      return {
        name,
        commit: await this._readCommitByBranchOrTag(dir, name),
      };
    }));
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

  private async _readCommitByBranchOrTag(dir: string, name: string): Promise<Commit> {
    const hash = (await readFileAsync(path.join(this.gitDir, 'refs', dir, name), 'utf8')).trim();
    return await Commit.readCommit(this.gitDir, hash);
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
