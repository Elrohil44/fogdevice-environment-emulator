#!/bin/bash

set -e

VERSION=`yarn -s echo-version`

docker build -t elrohil/fogdevice-environment-emulator:latest -t elrohil/fogdevice-environment-emulator:${VERSION} ./
