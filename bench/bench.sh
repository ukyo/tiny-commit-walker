echo "read 10000 commits async";        time node read-10000-commits.js 10000-commits-dot-git
echo "read 10000 commits sync";         time node read-10000-commits-sync.js 10000-commits-dot-git
echo "read 10000 commits async packed"; time node read-10000-commits.js 10000-commits-packed-dot-git
echo "read 10000 commits sync packed";  time node read-10000-commits-sync.js 10000-commits-packed-dot-git
