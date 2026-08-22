#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# This root adapter publishes the explicitly authorized visual-preview Site.
# The canonical production build remains separate and defaults to real auth.
export ATENDEIA_DEPLOYMENT_STAGE="preview"
export VITE_ATENDEIA_STAGE="preview"
export VITE_ATENDEIA_PREVIEW="true"

exec "${script_dir}/build-verified.sh" "$@"
