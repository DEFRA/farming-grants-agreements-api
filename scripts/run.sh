#!/bin/sh

set -e

# Extract CA certificates from TRUSTSTORE_* environment variables
# and save them to a file that Node.js will trust
env | grep "^TRUSTSTORE_" | cut -d'=' -f2- | base64 -d > /tmp/certs.pem

export NODE_EXTRA_CA_CERTS="/tmp/certs.pem"

# Use the command passed to the script, or default to starting the app
if [ $# -eq 0 ]; then
  node src
else
  exec "$@"
fi
