#!/bin/bash

set -e

VERSION=`yarn -s echo-version`

echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin

docker push elrohil/fogdevice-environment-emulator:latest
docker push elrohil/fogdevice-environment-emulator:${VERSION}
