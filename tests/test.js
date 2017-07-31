import test from 'ava';
import * as path from 'path';
import { Commit, Repository } from '../index';

const repo1 = new Repository(path.join(__dirname, 'fixture', 'repo1-dot-git'));
const repo2 = new Repository(path.join(__dirname, 'fixture', 'repo2-dot-git'));
const repo1Packed = new Repository(path.join(__dirname, 'fixture', 'repo1-packed-dot-git'));
const repo2Packed = new Repository(path.join(__dirname, 'fixture', 'repo2-packed-dot-git'));

test('find gitDir', async t => {
  const gitDir = await Repository.findGitDir(__dirname);
  t.is(gitDir, path.resolve(__dirname, '../.git'));
});

test('find gitDir (failed)', async t => {
  const gitDir = await Repository.findGitDir('/');
  t.is(gitDir, undefined);
});

test('find gitDir sync', t => {
  const gitDir = Repository.findGitDirSync(__dirname);
  t.is(gitDir, path.resolve(__dirname, '../.git'));
});

test('find gitDir sync (failed)', t => {
  const gitDir = Repository.findGitDirSync('/');
  t.is(gitDir, undefined);
});

async function testReadBranches(t, repo) {
  const branches = await repo.readBranches();
  t.is(branches.length, 5);
  t.truthy(branches.find(b => b.name === 'master'));
  t.is(branches.find(b => b.name === 'master').commit.hash, (await repo.readCommitByBranch('master')).hash);
  t.truthy(branches.find(b => b.name === 'a'));
  t.is(branches.find(b => b.name === 'a').commit.hash, (await repo.readCommitByBranch('a')).hash);
  t.truthy(branches.find(b => b.name === 'b'));
  t.is(branches.find(b => b.name === 'b').commit.hash, (await repo.readCommitByBranch('b')).hash);
  t.truthy(branches.find(b => b.name === 'c'));
  t.is(branches.find(b => b.name === 'c').commit.hash, (await repo.readCommitByBranch('c')).hash);
  t.truthy(branches.find(b => b.name === 'd'));
  t.is(branches.find(b => b.name === 'd').commit.hash, (await repo.readCommitByBranch('d')).hash);
  const remoteBranches = await repo.readBranches('remotes');
  t.is(remoteBranches.length, 3);
  t.truthy(remoteBranches.find(b => b.name === 'origin/master'));
  t.is(remoteBranches.find(b => b.name === 'origin/master').commit.hash, (await repo.readCommitByBranch('origin/master')).hash);
  t.truthy(remoteBranches.find(b => b.name === 'origin/foo'));
  t.is(remoteBranches.find(b => b.name === 'origin/foo').commit.hash, (await repo.readCommitByBranch('origin/foo')).hash);
  t.truthy(remoteBranches.find(b => b.name === 'origin/bar'));
  t.is(remoteBranches.find(b => b.name === 'origin/bar').commit.hash, (await repo.readCommitByBranch('origin/bar')).hash);
  const allBranches = await repo.readBranches(['heads', 'remotes']);
  t.is(allBranches.length, 8);
  t.truthy(allBranches.find(b => b.name === 'master'));
  t.is(allBranches.find(b => b.name === 'master').commit.hash, (await repo.readCommitByBranch('master')).hash);
  t.truthy(allBranches.find(b => b.name === 'a'));
  t.is(allBranches.find(b => b.name === 'a').commit.hash, (await repo.readCommitByBranch('a')).hash);
  t.truthy(allBranches.find(b => b.name === 'b'));
  t.is(allBranches.find(b => b.name === 'b').commit.hash, (await repo.readCommitByBranch('b')).hash);
  t.truthy(allBranches.find(b => b.name === 'c'));
  t.is(allBranches.find(b => b.name === 'c').commit.hash, (await repo.readCommitByBranch('c')).hash);
  t.truthy(allBranches.find(b => b.name === 'd'));
  t.is(allBranches.find(b => b.name === 'd').commit.hash, (await repo.readCommitByBranch('d')).hash);
  t.truthy(allBranches.find(b => b.name === 'origin/master'));
  t.is(allBranches.find(b => b.name === 'origin/master').commit.hash, (await repo.readCommitByBranch('origin/master')).hash);
  t.truthy(allBranches.find(b => b.name === 'origin/foo'));
  t.is(allBranches.find(b => b.name === 'origin/foo').commit.hash, (await repo.readCommitByBranch('origin/foo')).hash);
  t.truthy(allBranches.find(b => b.name === 'origin/bar'));
  t.is(allBranches.find(b => b.name === 'origin/bar').commit.hash, (await repo.readCommitByBranch('origin/bar')).hash);
};

test('read branches', async t => await testReadBranches(t, repo1));
test('read branches (packed)', async t => await testReadBranches(t, repo1Packed));

function testReadBranchesSync(t, repo) {
  const branches = repo.readBranchesSync();
  t.is(branches.length, 5);
  t.truthy(branches.find(b => b.name === 'master'));
  t.is(branches.find(b => b.name === 'master').commit.hash, (repo.readCommitByBranchSync('master')).hash);
  t.truthy(branches.find(b => b.name === 'a'));
  t.is(branches.find(b => b.name === 'a').commit.hash, (repo.readCommitByBranchSync('a')).hash);
  t.truthy(branches.find(b => b.name === 'b'));
  t.is(branches.find(b => b.name === 'b').commit.hash, (repo.readCommitByBranchSync('b')).hash);
  t.truthy(branches.find(b => b.name === 'c'));
  t.is(branches.find(b => b.name === 'c').commit.hash, (repo.readCommitByBranchSync('c')).hash);
  t.truthy(branches.find(b => b.name === 'd'));
  t.is(branches.find(b => b.name === 'd').commit.hash, (repo.readCommitByBranchSync('d')).hash);
  const remoteBranches = repo.readBranchesSync('remotes');
  t.is(remoteBranches.length, 3);
  t.truthy(remoteBranches.find(b => b.name === 'origin/master'));
  t.is(remoteBranches.find(b => b.name === 'origin/master').commit.hash, (repo.readCommitByBranchSync('origin/master')).hash);
  t.truthy(remoteBranches.find(b => b.name === 'origin/foo'));
  t.is(remoteBranches.find(b => b.name === 'origin/foo').commit.hash, (repo.readCommitByBranchSync('origin/foo')).hash);
  t.truthy(remoteBranches.find(b => b.name === 'origin/bar'));
  t.is(remoteBranches.find(b => b.name === 'origin/bar').commit.hash, (repo.readCommitByBranchSync('origin/bar')).hash);
  const allBranches = repo.readBranchesSync(['heads', 'remotes']);
  t.is(allBranches.length, 8);
  t.truthy(allBranches.find(b => b.name === 'master'));
  t.is(allBranches.find(b => b.name === 'master').commit.hash, (repo.readCommitByBranchSync('master')).hash);
  t.truthy(allBranches.find(b => b.name === 'a'));
  t.is(allBranches.find(b => b.name === 'a').commit.hash, (repo.readCommitByBranchSync('a')).hash);
  t.truthy(allBranches.find(b => b.name === 'b'));
  t.is(allBranches.find(b => b.name === 'b').commit.hash, (repo.readCommitByBranchSync('b')).hash);
  t.truthy(allBranches.find(b => b.name === 'c'));
  t.is(allBranches.find(b => b.name === 'c').commit.hash, (repo.readCommitByBranchSync('c')).hash);
  t.truthy(allBranches.find(b => b.name === 'd'));
  t.is(allBranches.find(b => b.name === 'd').commit.hash, (repo.readCommitByBranchSync('d')).hash);
  t.truthy(allBranches.find(b => b.name === 'origin/master'));
  t.is(allBranches.find(b => b.name === 'origin/master').commit.hash, (repo.readCommitByBranchSync('origin/master')).hash);
  t.truthy(allBranches.find(b => b.name === 'origin/foo'));
  t.is(allBranches.find(b => b.name === 'origin/foo').commit.hash, (repo.readCommitByBranchSync('origin/foo')).hash);
  t.truthy(allBranches.find(b => b.name === 'origin/bar'));
  t.is(allBranches.find(b => b.name === 'origin/bar').commit.hash, (repo.readCommitByBranchSync('origin/bar')).hash);
}

test('read branches sync', t => testReadBranchesSync(t, repo1));
test('read branches sync (packed', t => testReadBranchesSync(t, repo1Packed));

async function testReadBranchHead(t, repo) {
  const head = await repo.readHead();
  t.is(head.type, 'branch');
  t.truthy(head.branch);
  t.is(head.branch.name, 'master');
  t.truthy(head.branch.commit);
}
test('read HEAD that is ref to branch', async t => await testReadBranchHead(t, repo1));
test('read HEAD that is ref to branch (packed)', async t => await testReadBranchHead(t, repo1Packed));

function testReadBranchHeadSync(t, repo) {
  const head = repo.readHeadSync();
  t.is(head.type, 'branch');
  t.truthy(head.branch);
  t.is(head.branch.name, 'master');
  t.truthy(head.branch.commit);
}

test('read HEAD that is ref to branch sync', t => testReadBranchHeadSync(t, repo1));
test('read HEAD that is ref to branch sync (packed)', t => testReadBranchHeadSync(t, repo1Packed));

async function testReadTags(t, repo) {
  const tags = await repo.readTags();
  t.is(tags.length, 4);
  t.truthy(tags.find(t => t.name === 'v1'));
  t.is(tags.find(t => t.name === 'v1').commit.hash, (await repo.readCommitByTag('v1')).hash);
  t.truthy(tags.find(t => t.name === 'v2'));
  t.is(tags.find(t => t.name === 'v2').commit.hash, (await repo.readCommitByTag('v2')).hash);
  t.truthy(tags.find(t => t.name === 'v3'));
  t.is(tags.find(t => t.name === 'v3').commit.hash, (await repo.readCommitByTag('v3')).hash);
  t.truthy(tags.find(t => t.name === 'v4.comment'));
  t.is(tags.find(t => t.name === 'v4.comment').commit.hash, (await repo.readCommitByTag('v4.comment')).hash);
}

test('read tags', async t => await testReadTags(t, repo2));
test('read tags (packed)', async t => await testReadTags(t, repo2Packed));

function testReadTagsSync(t, repo) {
  const tags = repo.readTagsSync();
  t.is(tags.length, 4);
  t.truthy(tags.find(t => t.name === 'v1'));
  t.is(tags.find(t => t.name === 'v1').commit.hash, (repo.readCommitByTagSync('v1')).hash);
  t.truthy(tags.find(t => t.name === 'v2'));
  t.is(tags.find(t => t.name === 'v2').commit.hash, (repo.readCommitByTagSync('v2')).hash);
  t.truthy(tags.find(t => t.name === 'v3'));
  t.is(tags.find(t => t.name === 'v3').commit.hash, (repo.readCommitByTagSync('v3')).hash);
  t.truthy(tags.find(t => t.name === 'v4.comment'));
  t.is(tags.find(t => t.name === 'v4.comment').commit.hash, (repo.readCommitByTagSync('v4.comment')).hash);
}

test('read tags sync', t => testReadTagsSync(t, repo2));
test('read tags sync (packed)', t => testReadTagsSync(t, repo2Packed));

async function testReadCommitHead(t, repo) {
  const head = await repo.readHead();
  t.is(head.type, 'commit');
  t.truthy(head.commit);
  t.true(head.commit.hash.startsWith('716debc'));
}

test('read HEAD that is ref to commit hash', async t => await testReadCommitHead(t, repo2));
test('read HEAD that is ref to commit hash (packed)', async t => await testReadCommitHead(t, repo2Packed));

function testReadCommitHeadSync(t, repo) {
  const head = repo.readHeadSync();
  t.is(head.type, 'commit');
  t.truthy(head.commit);
  t.true(head.commit.hash.startsWith('716debc'));
}

test('read HEAD that is ref to commit hash sync', t => testReadCommitHeadSync(t, repo2));
test('read HEAD that is ref to commit hash sync (packed)', t => testReadCommitHeadSync(t, repo2Packed));

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
async function testWalkCommits(t, repo) {
  const branches = await repo.readBranches();
  const head = await repo.readHead();
  let commit = head.branch.commit;
  // master
  t.is(head.branch.name, 'master');
  t.true(commit.hash.startsWith('8615421'));
  t.is(commit.parentHashes.length, 3);
  t.true(commit.isMergeCommit);
  t.true(commit.parentHashes[0].startsWith('90355ed'), 'base parent commit');
  t.true(commit.parentHashes[1].startsWith('9cf93cb'), '"a" branch');
  t.true(commit.parentHashes[2].startsWith('27ed78c'), '"c" branch');
  t.true(commit.baseParentHash.startsWith('90355ed'));
  t.true(commit.mergedParentHashes[0].startsWith('9cf93cb'));
  t.true(commit.mergedParentHashes[1].startsWith('27ed78c'));
  t.is(commit.author.name, 'ukyo');
  t.is(commit.author.email, 'ukyo.web@gmail.com');
  t.is(commit.author.date.toISOString(), '2017-07-11T09:58:57.000Z');
  t.is(commit.author.timezoneOffset, 540 * 60 * 1000);
  t.is(commit.committer.name, 'ukyo');
  t.is(commit.committer.email, 'ukyo.web@gmail.com');
  t.is(commit.committer.date.toISOString(), '2017-07-11T09:58:57.000Z');
  t.is(commit.committer.timezoneOffset, 540 * 60 * 1000);
  t.is(commit.message, `Merge branches 'a' and 'c'`);
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
}

test('walk commits', async t => await testWalkCommits(t, repo1));
test('walk commits (packed)', async t => await testWalkCommits(t, repo1Packed));

function testWalkCommitsSync(t, repo) {
  const branches = repo.readBranchesSync();
  const head = repo.readHeadSync();
  let commit = head.branch.commit;
  // master
  t.is(head.branch.name, 'master');
  t.true(commit.hash.startsWith('8615421'));
  t.is(commit.parentHashes.length, 3);
  t.true(commit.isMergeCommit);
  t.true(commit.parentHashes[0].startsWith('90355ed'), 'base parent commit');
  t.true(commit.parentHashes[1].startsWith('9cf93cb'), '"a" branch');
  t.true(commit.parentHashes[2].startsWith('27ed78c'), '"c" branch');
  t.is(commit.author.name, 'ukyo');
  t.is(commit.author.email, 'ukyo.web@gmail.com');
  t.is(commit.author.date.toISOString(), '2017-07-11T09:58:57.000Z');
  t.is(commit.author.timezoneOffset, 540 * 60 * 1000);
  t.is(commit.committer.name, 'ukyo');
  t.is(commit.committer.email, 'ukyo.web@gmail.com');
  t.is(commit.committer.date.toISOString(), '2017-07-11T09:58:57.000Z');
  t.is(commit.committer.timezoneOffset, 540 * 60 * 1000);
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
}

test('walk commits sync', t => testWalkCommitsSync(t, repo1));
test('walk commits sync (packed)', t => testWalkCommitsSync(t, repo1Packed));
