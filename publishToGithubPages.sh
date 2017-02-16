#!/bin/bash

# This is more dangerous than a monkey with a razor. Disabling for now (after disaster)

GH_PAGES_BRANCH=gh-pages

TMP_DIR=/tmp/immedia.d
BRANCH=`git branch | grep "*" | awk {'print $2'}`

#if [ ${GH_PAGES_BRANCH} = ${BRANCH} ] ; then
#  echo "Choose another branch to deploy, not ${BRANCH}!"
#  exit
#fi

#echo "I'm going to deploy the branch ${BRANCH} to github pages (and will remove whatever is there). OK? (Ctrl-C for 'No')"
#read a

#gulp build

#echo "Done with build... continue?"
#read a

#rm -rf ${TMP_DIR} 2>/dev/null
#mkdir ${TMP_DIR}

#cp -rp dist/* ${TMP_DIR}

#git checkout ${GH_PAGES_BRANCH}

#git rm -fr .

#cp -r ${TMP_DIR}/* .

#git add .

#git commit -m "Updated version from ${BRANCH}"

#git push adamantivm gh-pages

#git checkout ${BRANCH}

