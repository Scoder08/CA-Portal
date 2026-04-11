#!/usr/bin/env bash
set -e

# Install system libraries required by WeasyPrint
apt-get install -y --no-install-recommends \
  libpango-1.0-0 \
  libpangoft2-1.0-0 \
  libharfbuzz0b \
  libfontconfig1 \
  libgdk-pixbuf2.0-0 \
  shared-mime-info

pip install -r requirements.txt
