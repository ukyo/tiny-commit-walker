#!/bin/bash
if [ -e fixture/10000-commits-dot-git ]; then
  echo "start to bench."
else
  echo "initializing..."
  tar xzf fixture/10000-commits-dot-git.tar.gz -C ./fixture
  echo "complete!"
  echo "start to bench."
fi
echo "read 10000 commits async";        time node read-10000-commits.js 10000-commits-dot-git
echo "read 10000 commits sync";         time node read-10000-commits-sync.js 10000-commits-dot-git
echo "read 10000 commits async packed"; time node read-10000-commits.js 10000-commits-packed-dot-git
echo "read 10000 commits sync packed";  time node read-10000-commits-sync.js 10000-commits-packed-dot-git
