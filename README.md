# Tiny commit walker

Tiny git commit walker has no native modules.

[![Build Status](https://travis-ci.org/ukyo/tiny-commit-walker.svg?branch=master)](https://travis-ci.org/ukyo/tiny-commit-walker) [![Build status](https://ci.appveyor.com/api/projects/status/y6icdkcok01fq927/branch/master?svg=true)](https://ci.appveyor.com/project/ukyo/tiny-commit-walker/branch/master)
 [![npm version](https://badge.fury.io/js/tiny-commit-walker.svg)](https://badge.fury.io/js/tiny-commit-walker)

# Install

```
$ npm install --save tiny-commit-walker
```

# Usage

```js
import { Repository } from 'tiny-commit-walker';

(async () => {
  const repo = new Repository('path/to/repo/.git');
  // const repo = new Repository(await Repository.findGitDir('path/to/repo'));
  const branches = await repo.readBranches();
  const tags = await repo.readTags();
  const branch = await repo.readCommitByBranch('master');
  console.log(branch.name); // master
  let commit = branch.commit;
  while (commit.hasParents) {
    console.log(commit.hash);
    commit = await commit.walk(); // default parameter of commit.walk is base parent hash.
  }
})();

// or

const repo = new Repository('path/to/repo/.git');
const branches = repo.readBranchesSync();
const tags = repo.readTagsSync();
const branch = repo.readCommitByBranchSync('master');
console.log(branch.name); // master
let commit = branch.commit;
while (commit.hasParents) {
  console.log(commit.hash);
  commit = commit.walkSync();
}
```

# Documentation

https://ukyo.github.io/tiny-commit-walker
