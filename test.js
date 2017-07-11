import test from 'ava';
import * as lib from './index';

test('funcs are exported', (t) => {
  t.truthy(lib);
  t.truthy(lib.Commit);
  t.truthy(lib.Repository);
  t.truthy(lib.readCommit);
  t.truthy(lib.readCommitSync);
});

test('new Repository(repo)', t => {
  const repo = new lib.Repository('fixture');
  t.is(repo.gitRoot, 'fixture/.git');
});

const repo = new lib.Repository('fixture');

test('repo.readBranches()', async t => {
  const branches = await repo.readBranches();
  t.truthy(branches.find(b => b.name === 'master'));
  t.truthy(branches.find(b => b.name === 'a'));
  t.truthy(branches.find(b => b.name === 'b'));
  t.truthy(branches.find(b => b.name === 'c'));
  t.truthy(branches.find(b => b.name === 'd'));
});

test('repo.readHead()', async t => {
  const head = await repo.readHead();
  t.is(head.type, 'branch');
  t.truthy(head.branch);
  t.is(head.branch.name, 'master');
  t.truthy(head.branch.commit);
});

test('commit.walk', async t => {
  const branches = await repo.readBranches();
  const head = await repo.readHead();
  let commit = head.branch.commit;
  t.is(commit.hash, '8615421ca60a7d5d1cd19bf97bd100e19cb0dd47');
  t.deepEqual(commit.parentHashs, [
    '90355ed8dbd6458efb0e8191c958911fb26f1d94',
    '9cf93cbe343a40cb6f4dcb7c54c0fb499eb9f217',
    '27ed78cdfce91731cc270834e547006e68c160a4',
  ]);
  t.true(commit.isMergeCommit);
  t.is(commit.baseParentHash, '90355ed8dbd6458efb0e8191c958911fb26f1d94');
  commit = await commit.walk(); t.is(commit.hash, '90355ed8dbd6458efb0e8191c958911fb26f1d94');
  commit = await commit.walk(); t.is(commit.hash, '3c07e56a57f63a994552a657a8bee1095d95da9c');
  commit = await commit.walk(); t.is(commit.hash, 'fe65269f725952a1913e82bd078ecb95c1c719ac');
  t.not(commit.hasParents);
});
