import test from 'ava';
import * as path from 'path';
import { Commit, Repository } from '../index';

const repo1 = new Repository(path.join(__dirname, 'fixture', 'repo1-dot-git'));
const repo2 = new Repository(path.join(__dirname, 'fixture', 'repo2-dot-git'));
const repo1Packed = new Repository(path.join(__dirname, 'fixture', 'repo1-packed-dot-git'));

test('find gitDir', async t => {
  const gitDir = await Repository.findGitDir(__dirname);
  t.is(gitDir, path.resolve(__dirname, '../.git'));
});

test('find gitDir (fail)', async t => {
  const gitDir = await Repository.findGitDir('/');
  t.is(gitDir, undefined);
});

test('find gitDir sync', t => {
  const gitDir = Repository.findGitDirSync(__dirname);
  t.is(gitDir, path.resolve(__dirname, '../.git'));
});

test('find gitDir sync', t => {
  const gitDir = Repository.findGitDirSync('/');
  t.is(gitDir, undefined);
});

test('read branches', async t => {
  const branches = await repo1.readBranches();
  t.is(branches.length, 5);
  t.truthy(branches.find(b => b.name === 'master'));
  t.is(branches.find(b => b.name === 'master').commit.hash, (await repo1.readCommitByBranch('master')).hash);
  t.truthy(branches.find(b => b.name === 'a'));
  t.is(branches.find(b => b.name === 'a').commit.hash, (await repo1.readCommitByBranch('a')).hash);
  t.truthy(branches.find(b => b.name === 'b'));
  t.is(branches.find(b => b.name === 'b').commit.hash, (await repo1.readCommitByBranch('b')).hash);
  t.truthy(branches.find(b => b.name === 'c'));
  t.is(branches.find(b => b.name === 'c').commit.hash, (await repo1.readCommitByBranch('c')).hash);
  t.truthy(branches.find(b => b.name === 'd'));
  t.is(branches.find(b => b.name === 'd').commit.hash, (await repo1.readCommitByBranch('d')).hash);
});

test('read branches sync', t => {
  const branches = repo1.readBranchesSync();
  t.is(branches.length, 5);
  t.truthy(branches.find(b => b.name === 'master'));
  t.is(branches.find(b => b.name === 'master').commit.hash, (repo1.readCommitByBranchSync('master')).hash);
  t.truthy(branches.find(b => b.name === 'a'));
  t.is(branches.find(b => b.name === 'a').commit.hash, (repo1.readCommitByBranchSync('a')).hash);
  t.truthy(branches.find(b => b.name === 'b'));
  t.is(branches.find(b => b.name === 'b').commit.hash, (repo1.readCommitByBranchSync('b')).hash);
  t.truthy(branches.find(b => b.name === 'c'));
  t.is(branches.find(b => b.name === 'c').commit.hash, (repo1.readCommitByBranchSync('c')).hash);
  t.truthy(branches.find(b => b.name === 'd'));
  t.is(branches.find(b => b.name === 'd').commit.hash, (repo1.readCommitByBranchSync('d')).hash);
});

test('read HEAD that is ref to branch', async t => {
  const head = await repo1.readHead();
  t.is(head.type, 'branch');
  t.truthy(head.branch);
  t.is(head.branch.name, 'master');
  t.truthy(head.branch.commit);
});

test('read HEAD that is ref to branch sync', t => {
  const head = repo1.readHeadSync();
  t.is(head.type, 'branch');
  t.truthy(head.branch);
  t.is(head.branch.name, 'master');
  t.truthy(head.branch.commit);
});

test('read tags', async t => {
  const tags = await repo2.readTags();
  t.is(tags.length, 3);
  t.truthy(tags.find(t => t.name === 'v1'));
  t.is(tags.find(t => t.name === 'v1').commit.hash, (await repo2.readCommitByTag('v1')).hash);
  t.truthy(tags.find(t => t.name === 'v2'));
  t.is(tags.find(t => t.name === 'v2').commit.hash, (await repo2.readCommitByTag('v2')).hash);
  t.truthy(tags.find(t => t.name === 'v3'));
  t.is(tags.find(t => t.name === 'v3').commit.hash, (await repo2.readCommitByTag('v3')).hash);
});

test('read tags sync', t => {
  const tags = repo2.readTagsSync();
  t.is(tags.length, 3);
  t.truthy(tags.find(t => t.name === 'v1'));
  t.is(tags.find(t => t.name === 'v1').commit.hash, (repo2.readCommitByTagSync('v1')).hash);
  t.truthy(tags.find(t => t.name === 'v2'));
  t.is(tags.find(t => t.name === 'v2').commit.hash, (repo2.readCommitByTagSync('v2')).hash);
  t.truthy(tags.find(t => t.name === 'v3'));
  t.is(tags.find(t => t.name === 'v3').commit.hash, (repo2.readCommitByTagSync('v3')).hash);
});

test('read HEAD that is ref to commit hash', async t => {
  const head = await repo2.readHead();
  t.is(head.type, 'commit');
  t.truthy(head.commit);
  t.true(head.commit.hash.startsWith('716debc'));
});

test('read HEAD that is ref to commit hash sync', t => {
  const head = repo2.readHeadSync();
  t.is(head.type, 'commit');
  t.truthy(head.commit);
  t.true(head.commit.hash.startsWith('716debc'));
});

/*
current branch is master.
* b1c1409 d3
* fa6ba37 d2
* 2ca5ca9 d1
| *-.   8615421 Merge branches 'a' and 'c'
| |\ \
| |_|/
|/| |
* | | 27ed78c c3
* | | 25368be c2
* | | b282295 c1
| | *   9cf93cb Merge branch 'b' into a
| | |\
| | | * 1361abe b2
| | | * d19f4a6 b1
| | * | b413700 a3
| | |/
| | * 5c40684 a2
| | * a7546ba a1
| |/
|/|
| * 90355ed commit3
|/
* 3c07e56 commit2
* fe65269 commit1

*/
test('walk commits', async t => {
  const branches = await repo1.readBranches();
  const head = await repo1.readHead();
  let commit = head.branch.commit;
  // master
  t.is(head.branch.name, 'master');
  t.true(commit.hash.startsWith('8615421'));
  t.is(commit.parentHashes.length, 3);
  t.true(commit.isMergeCommit);
  t.true(commit.parentHashes[0].startsWith('90355ed'), 'base parent commit');
  t.true(commit.parentHashes[1].startsWith('9cf93cb'), '"a" branch');
  t.true(commit.parentHashes[2].startsWith('27ed78c'), '"c" branch');
  t.true(commit.isMergeCommit);
  t.true(commit.baseParentHash.startsWith('90355ed'));
  t.true(commit.mergedParentHashes[0].startsWith('9cf93cb'));
  t.true(commit.mergedParentHashes[1].startsWith('27ed78c'));
  t.true((await commit.walk(commit.parentHashes[1])).hash.startsWith('9cf93cb'), 'walk to "a" branch');
  t.true((await commit.walk(commit.parentHashes[2])).hash.startsWith('27ed78c'), 'walk to "c" branch');
  t.is(commit.baseParentHash, commit.parentHashes[0]);
  const c = await commit.walk(commit.baseParentHash);
  commit = await commit.walk();
  t.deepEqual(commit, c, 'default paramater of commit.walk is commit.baseParentHash');
  t.true(commit.hash.startsWith('90355ed')); t.not(commit.isMergeCommit);
  commit = await commit.walk();
  t.true(commit.hash.startsWith('3c07e56')); t.not(commit.isMergeCommit);
  commit = await commit.walk();
  t.true(commit.hash.startsWith('fe65269'));
  t.not(commit.hasParents);
  // a
  commit = branches.find(b => b.name === 'a').commit;
  t.true(commit.hash.startsWith('9cf93cb'));
  t.is(commit.parentHashes.length, 2);
  t.true(commit.isMergeCommit);
  t.true(commit.parentHashes[0].startsWith('b413700'));
  t.true(commit.parentHashes[1].startsWith('1361abe'));
  commit = await commit.walk();
  t.true(commit.hash.startsWith('b413700')); t.not(commit.isMergeCommit);
  commit = await commit.walk();
  t.true(commit.hash.startsWith('5c40684')); t.not(commit.isMergeCommit);
  commit = await commit.walk();
  t.true(commit.hash.startsWith('a7546ba')); t.not(commit.isMergeCommit);
  commit = await commit.walk();
  t.true(commit.hash.startsWith('3c07e56'));
  // b
  commit = branches.find(b => b.name === 'b').commit;
  t.true(commit.hash.startsWith('1361abe'));
  commit = await commit.walk();
  t.true(commit.hash.startsWith('d19f4a6')); t.not(commit.isMergeCommit);
  commit = await commit.walk();
  t.true(commit.hash.startsWith('5c40684'));
  // c
  commit = branches.find(b => b.name === 'c').commit;
  t.true(commit.hash.startsWith('27ed78c')); t.not(commit.isMergeCommit);
  commit = await commit.walk();
  t.true(commit.hash.startsWith('25368be')); t.not(commit.isMergeCommit);
  commit = await commit.walk();
  t.true(commit.hash.startsWith('b282295')); t.not(commit.isMergeCommit);
  commit = await commit.walk();
  t.true(commit.hash.startsWith('3c07e56'));
  // d
  commit = branches.find(b => b.name === 'd').commit;
  t.true(commit.hash.startsWith('b1c1409')); t.not(commit.isMergeCommit);
  commit = await commit.walk();
  t.true(commit.hash.startsWith('fa6ba37')); t.not(commit.isMergeCommit);
  commit = await commit.walk();
  t.true(commit.hash.startsWith('2ca5ca9')); t.not(commit.isMergeCommit);
  commit = await commit.walk();
  t.true(commit.hash.startsWith('27ed78c'));
});

test('walk commits sync', t => {
  const branches = repo1.readBranchesSync();
  const head = repo1.readHeadSync();
  let commit = head.branch.commit;
  // master
  t.is(head.branch.name, 'master');
  t.true(commit.hash.startsWith('8615421'));
  t.is(commit.parentHashes.length, 3);
  t.true(commit.isMergeCommit);
  t.true(commit.parentHashes[0].startsWith('90355ed'), 'base parent commit');
  t.true(commit.parentHashes[1].startsWith('9cf93cb'), '"a" branch');
  t.true(commit.parentHashes[2].startsWith('27ed78c'), '"c" branch');
  t.true(commit.isMergeCommit);
  t.true(commit.baseParentHash.startsWith('90355ed'));
  t.true((commit.walkSync(commit.parentHashes[1])).hash.startsWith('9cf93cb'), 'walk to "a" branch');
  t.true((commit.walkSync(commit.parentHashes[2])).hash.startsWith('27ed78c'), 'walk to "c" branch');
  t.is(commit.baseParentHash, commit.parentHashes[0]);
  const c = commit.walkSync(commit.baseParentHash);
  commit = commit.walkSync();
  t.deepEqual(commit, c, 'default paramater of commit.walk is commit.baseParentHash');
  t.true(commit.hash.startsWith('90355ed')); t.not(commit.isMergeCommit);
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('3c07e56')); t.not(commit.isMergeCommit);
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('fe65269'));
  t.not(commit.hasParents);
  // a
  commit = branches.find(b => b.name === 'a').commit;
  t.true(commit.hash.startsWith('9cf93cb'));
  t.is(commit.parentHashes.length, 2);
  t.true(commit.isMergeCommit);
  t.true(commit.parentHashes[0].startsWith('b413700'));
  t.true(commit.parentHashes[1].startsWith('1361abe'));
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('b413700')); t.not(commit.isMergeCommit);
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('5c40684')); t.not(commit.isMergeCommit);
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('a7546ba')); t.not(commit.isMergeCommit);
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('3c07e56'));
  // b
  commit = branches.find(b => b.name === 'b').commit;
  t.true(commit.hash.startsWith('1361abe'));
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('d19f4a6')); t.not(commit.isMergeCommit);
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('5c40684'));
  // c
  commit = branches.find(b => b.name === 'c').commit;
  t.true(commit.hash.startsWith('27ed78c')); t.not(commit.isMergeCommit);
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('25368be')); t.not(commit.isMergeCommit);
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('b282295')); t.not(commit.isMergeCommit);
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('3c07e56'));
  // d
  commit = branches.find(b => b.name === 'd').commit;
  t.true(commit.hash.startsWith('b1c1409')); t.not(commit.isMergeCommit);
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('fa6ba37')); t.not(commit.isMergeCommit);
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('2ca5ca9')); t.not(commit.isMergeCommit);
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('27ed78c'));
});

test('walk commits (packed)', async t => {
  const branches = await repo1Packed.readBranches();
  const head = await repo1Packed.readHead();
  let commit = head.branch.commit;
  // master
  t.is(head.branch.name, 'master');
  t.true(commit.hash.startsWith('8615421'));
  t.is(commit.parentHashes.length, 3);
  t.true(commit.isMergeCommit);
  t.true(commit.parentHashes[0].startsWith('90355ed'), 'base parent commit');
  t.true(commit.parentHashes[1].startsWith('9cf93cb'), '"a" branch');
  t.true(commit.parentHashes[2].startsWith('27ed78c'), '"c" branch');
  t.true(commit.isMergeCommit);
  t.true(commit.baseParentHash.startsWith('90355ed'));
  t.true(commit.mergedParentHashes[0].startsWith('9cf93cb'));
  t.true(commit.mergedParentHashes[1].startsWith('27ed78c'));
  t.true((await commit.walk(commit.parentHashes[1])).hash.startsWith('9cf93cb'), 'walk to "a" branch');
  t.true((await commit.walk(commit.parentHashes[2])).hash.startsWith('27ed78c'), 'walk to "c" branch');
  t.is(commit.baseParentHash, commit.parentHashes[0]);
  const c = await commit.walk(commit.baseParentHash);
  // console.log(commit);
  commit = await commit.walk();
  t.deepEqual(commit, c, 'default paramater of commit.walk is commit.baseParentHash');
  t.true(commit.hash.startsWith('90355ed')); t.not(commit.isMergeCommit);
  commit = await commit.walk();
  t.true(commit.hash.startsWith('3c07e56')); t.not(commit.isMergeCommit);
  commit = await commit.walk();
  t.true(commit.hash.startsWith('fe65269'));
  t.not(commit.hasParents);
  // a
  commit = branches.find(b => b.name === 'a').commit;
  t.true(commit.hash.startsWith('9cf93cb'));
  t.is(commit.parentHashes.length, 2);
  t.true(commit.isMergeCommit);
  t.true(commit.parentHashes[0].startsWith('b413700'));
  t.true(commit.parentHashes[1].startsWith('1361abe'));
  commit = await commit.walk();
  t.true(commit.hash.startsWith('b413700')); t.not(commit.isMergeCommit);
  commit = await commit.walk();
  t.true(commit.hash.startsWith('5c40684')); t.not(commit.isMergeCommit);
  commit = await commit.walk();
  t.true(commit.hash.startsWith('a7546ba')); t.not(commit.isMergeCommit);
  commit = await commit.walk();
  t.true(commit.hash.startsWith('3c07e56'));
  // b
  commit = branches.find(b => b.name === 'b').commit;
  t.true(commit.hash.startsWith('1361abe'));
  commit = await commit.walk();
  t.true(commit.hash.startsWith('d19f4a6')); t.not(commit.isMergeCommit);
  commit = await commit.walk();
  t.true(commit.hash.startsWith('5c40684'));
  // c
  commit = branches.find(b => b.name === 'c').commit;
  t.true(commit.hash.startsWith('27ed78c')); t.not(commit.isMergeCommit);
  commit = await commit.walk();
  t.true(commit.hash.startsWith('25368be')); t.not(commit.isMergeCommit);
  commit = await commit.walk();
  t.true(commit.hash.startsWith('b282295')); t.not(commit.isMergeCommit);
  commit = await commit.walk();
  t.true(commit.hash.startsWith('3c07e56'));
  // d
  commit = branches.find(b => b.name === 'd').commit;
  t.true(commit.hash.startsWith('b1c1409')); t.not(commit.isMergeCommit);
  commit = await commit.walk();
  t.true(commit.hash.startsWith('fa6ba37')); t.not(commit.isMergeCommit);
  commit = await commit.walk();
  t.true(commit.hash.startsWith('2ca5ca9')); t.not(commit.isMergeCommit);
  commit = await commit.walk();
  t.true(commit.hash.startsWith('27ed78c'));
});

test('walk commits sync (packed)', t => {
  const branches = repo1Packed.readBranchesSync();
  const head = repo1Packed.readHeadSync();
  let commit = head.branch.commit;
  // master
  t.is(head.branch.name, 'master');
  t.true(commit.hash.startsWith('8615421'));
  t.is(commit.parentHashes.length, 3);
  t.true(commit.isMergeCommit);
  t.true(commit.parentHashes[0].startsWith('90355ed'), 'base parent commit');
  t.true(commit.parentHashes[1].startsWith('9cf93cb'), '"a" branch');
  t.true(commit.parentHashes[2].startsWith('27ed78c'), '"c" branch');
  t.true(commit.isMergeCommit);
  t.true(commit.baseParentHash.startsWith('90355ed'));
  t.true((commit.walkSync(commit.parentHashes[1])).hash.startsWith('9cf93cb'), 'walk to "a" branch');
  t.true((commit.walkSync(commit.parentHashes[2])).hash.startsWith('27ed78c'), 'walk to "c" branch');
  t.is(commit.baseParentHash, commit.parentHashes[0]);
  const c = commit.walkSync(commit.baseParentHash);
  commit = commit.walkSync();
  t.deepEqual(commit, c, 'default paramater of commit.walk is commit.baseParentHash');
  t.true(commit.hash.startsWith('90355ed')); t.not(commit.isMergeCommit);
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('3c07e56')); t.not(commit.isMergeCommit);
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('fe65269'));
  t.not(commit.hasParents);
  // a
  commit = branches.find(b => b.name === 'a').commit;
  t.true(commit.hash.startsWith('9cf93cb'));
  t.is(commit.parentHashes.length, 2);
  t.true(commit.isMergeCommit);
  t.true(commit.parentHashes[0].startsWith('b413700'));
  t.true(commit.parentHashes[1].startsWith('1361abe'));
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('b413700')); t.not(commit.isMergeCommit);
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('5c40684')); t.not(commit.isMergeCommit);
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('a7546ba')); t.not(commit.isMergeCommit);
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('3c07e56'));
  // b
  commit = branches.find(b => b.name === 'b').commit;
  t.true(commit.hash.startsWith('1361abe'));
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('d19f4a6')); t.not(commit.isMergeCommit);
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('5c40684'));
  // c
  commit = branches.find(b => b.name === 'c').commit;
  t.true(commit.hash.startsWith('27ed78c')); t.not(commit.isMergeCommit);
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('25368be')); t.not(commit.isMergeCommit);
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('b282295')); t.not(commit.isMergeCommit);
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('3c07e56'));
  // d
  commit = branches.find(b => b.name === 'd').commit;
  t.true(commit.hash.startsWith('b1c1409')); t.not(commit.isMergeCommit);
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('fa6ba37')); t.not(commit.isMergeCommit);
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('2ca5ca9')); t.not(commit.isMergeCommit);
  commit = commit.walkSync();
  t.true(commit.hash.startsWith('27ed78c'));
});
