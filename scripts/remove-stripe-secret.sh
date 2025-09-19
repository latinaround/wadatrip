#!/usr/bin/env bash
set -euo pipefail

SECRET_TO_REMOVE="${1:-}"
if [ -z "${SECRET_TO_REMOVE}" ]; then
  echo "Usage: ./scripts/remove-stripe-secret.sh <actual_stripe_secret>"
  exit 1
fi

if ! command -v git-filter-repo >/dev/null 2>&1; then
  echo "git-filter-repo is required. Install it first: pip install git-filter-repo"
  exit 1
fi

git filter-repo --force --replace-text <(printf '%s==>STRIPE_SECRET_KEY_REMOVED\n' "${SECRET_TO_REMOVE}")

echo "History rewritten. Force-push the branch once you've reviewed the rewritten history."
