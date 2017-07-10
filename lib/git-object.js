const fs = require('fs');
const util = require('util');
const zlib = require('zlib');

const readFileAsync = util.promisify(fs.readFile);
const inflateAsync = util.promisify(zlib.inflate);

const fileTypeDict = {
  40: 'tree',
  100: 'blob',
  120: 'symlink',
  160: 'submodule',
};

class GitObject {
  constructor(gitDirPath, type, size, body) {
    this._gitDirPath = gitDirPath;
    this.type = type;
    this.size = size;
    this._body = body;
  }
}

class GitTree extends GitObject {
  constructor(gitDirPath, type, size, body) {
    super(gitDirPath, type, size, body);
    // TODO
    // this.children = body.split('\n').map(line => {
    //   const [, head, name, hash] = line.match(/^(\d{5,6})\s([^\u0000]+)\u0000(.+)$/);
    //   return {
    //     type: fileTypeDict[head.slice(0, -3)],
    //     mode: head.slice(-3),
    //     name,
    //     hash,
    //   };
    // });
  }
}

class GitBlob extends GitObject {

}

class GitCommit extends GitObject {
  constructor(gitDirPath, type, size, body) {
    super(gitDirPath, type, size, body);
  }

  hasTree() {
    return /tree\s([a-f0-9]{40})/.test(this._body);
  }

  hasParent() {
    return /parent\s([a-f0-9]{40})/.test(this._body);
  }

  async loadTree() {
    const m = this._body.match(/tree\s([a-f0-9]{40})/);
    if (!m) throw new Error('This commit has no trees.');
    return await loadGitObject(this._gitDirPath, m[1]);
  }

  async loadParent() {
    const m = this._body.match(/parent\s([a-f0-9]{40})/);
    if (!m) throw new Error('This commit has no parents.');
    return await loadGitObject(this._gitDirPath, m[1]);
  }
}

class GitTag extends GitObject {

}

async function loadGitObject(gitDirPath, hash) {
  const deflatedCommit = await readFileAsync(gitDirPath + '/objects/' + hash.trim().replace(/^(.{2})(.{38})$/, '$1/$2'));
  const commit = (await inflateAsync(deflatedCommit)).toString('utf8');
  const [head, ...body] = commit.trim().split('\u0000');
  const [type, size] = head.split(/\s/);
  let Cls;
  switch (type) {
    case 'tree': Cls = GitTree; break;
    case 'blob': Cls = GitBlob; break;
    case 'commit': Cls = GitCommit; break;
    case 'tag': Cls = GitTag; break;
  }
  return new Cls(gitDirPath, type, size, body.join('\u0000'));
};

module.exports.loadGitObject = loadGitObject;

module.exports.GitObject = GitObject;
module.exports.GitTree = GitTree;
module.exports.GitBlob = GitBlob;
module.exports.GitCommit = GitCommit;
module.exports.GitTag = GitTag;
