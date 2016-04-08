#!/bin/bash

# http://stackoverflow.com/a/246128/312907
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do # resolve $SOURCE until the file is no longer a symlink
  DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE" # if $SOURCE was a relative symlink, we need to resolve it relative to the path where the symlink file was located
done
DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"

PARENTDIR=$( dirname "$DIR" )

if [ $(ps aux | grep node | grep app.js | grep -v grep | wc -l | tr -s "\n") -eq 0 ]; then
  source $PARENTDIR/.envrc
  node ./app.js > $PARENTDIR/logs/carbot.log
fi

