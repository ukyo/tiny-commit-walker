const gd = require('./lib/git-dir');
(async () => {
  const d = await gd.readGitDir('/Users/ukyo/work/git-miru-kun/.git');
  const bs = await d.readBranches();
  console.log(bs);
  const h = await d.readHead();
  console.log(h.commit);
  const c = await h.commit.readParent();
  console.log(c);
})();
