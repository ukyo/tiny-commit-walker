const fs = require('fs');
const util = require('util');

const statAsync = util.promisify(fs.stat);
const readFileAsync = util.promisify(fs.readFile);

class GitDir {
  constructor(path) {
    this.path = path;
  }

  async readHead() {
    const head = await readFileAsync(this.path + '/HEAD');
    const branchName = head.match(/^refs: refs\/heads\/(.+)$/)[1];
    
  }

  async readBranches() {

  }
}

module.exports.loadGitDir = async (path) => {
  const stats = await statAsync(path);
  if (stats.isDirectory()) {
    return new GitDir(path);
  } else {
    throw new Error(`${path} is not a directory.`);
  }
};
