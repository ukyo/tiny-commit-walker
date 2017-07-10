const fs = require('fs');
const util = require('util');
const go = require('./git-object');

const statAsync = util.promisify(fs.stat);
const readFileAsync = util.promisify(fs.readFile);
const readDirAsync = util.promisify(fs.readdir);

class GitDir {
  constructor(path) {
    this.path = path;
  }

  async readHead() {
    const head = await readFileAsync(this.path + '/HEAD', 'utf8');
    const branchName = head.trim().split('/').pop();
    return {
      branchName,
      commit: await this.readBranchAsCommit(branchName),
    }
  }

  async readBranchAsCommit(branchName) {
    const commitHash = await readFileAsync(this.path + '/refs/heads/' + branchName, 'utf8');
    const commit = await go.readGitObject(this.path, commitHash);
    return commit;
  }

  async readBrancheNames() {
    return await readDirAsync(this.path + '/refs/heads');
  }

  async readBranches() {
    const names = await this.readBrancheNames();
    return Promise.all(names.map(async name => {
      const commit = await this.readBranchAsCommit(name);
      return {
        branchName: name,
        commit,
      };
    }));
  }
}

module.exports.readGitDir = async (path) => {
  const stats = await statAsync(path);
  if (stats.isDirectory()) {
    return new GitDir(path);
  } else {
    throw new Error(`${path} is not a directory.`);
  }
};
