const gd = require('./index');
(async () => {
  const repo = new gd.Repository('.');
  const bs = await repo.readBranches();
  // console.log(bs);
  const h = await repo.readHead();
  // console.log(h.branch.commit.baseParentHash);
  const c = await h.branch.commit.walk();
  console.log(c);
})();
