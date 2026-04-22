#!/usr/bin/env bash
# Verify that protected files were not modified in the mass-reclass feature branch (last 7 commits).
set -e

FAIL=0

check() {
  local label="$1"
  local file="$2"
  local result
  result=$(git diff --stat HEAD~7..HEAD -- "$file")
  if [ -n "$result" ]; then
    echo "VIOLATION: $label ($file) was modified:" >&2
    echo "$result" >&2
    FAIL=1
  else
    echo "OK: $label untouched"
  fi
}

check "ct-widget.js"      "public/ct-widget.js"
check "meridian-relay.html" "public/meridian-relay.html"
check "CtApp.jsx"         "src/ct/CtApp.jsx"

if [ "$FAIL" -ne 0 ]; then
  echo "Scope check FAILED — protected files were modified." >&2
  exit 1
fi

echo "Scope check PASSED — all protected files are clean."
