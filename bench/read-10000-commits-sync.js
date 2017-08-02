const path = require('path');
const { Repository } = require('../dist');

const repo = new Repository(path.join(__dirname, 'fixture', process.argv[2]));
let commit = repo.readCommitByBranchSync('master');
while (commit.hasParents) {
  commit = commit.walkSync();
}
