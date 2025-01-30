#!/bin/bash

set -xe

if [-z $1]
then
	echo "Usage: ./install.sh <location>"
	exit 1
fi

FILES=(
	"main.js"
	"manifest.json"
	"styles.css"
)

for file in "${FILES[@]}"
do
	cp $file $1
done
