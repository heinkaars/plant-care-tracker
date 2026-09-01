#!/bin/bash
set -euo pipefail

# Claude Code on the web resets git identity to the Claude bot account
# (Claude <noreply@anthropic.com>) at the start of every session. The
# add-supabase-auth automation commits as itself, which then shows up
# under the "claude" GitHub account instead of heinkaars' contribution
# graph. Override it here so every commit this environment makes is
# attributed to heinkaars on GitHub (the users.noreply.github.com form
# is always recognized as verified for that account, no real email
# needed).
NAME="heinkaars"
EMAIL="219910040+heinkaars@users.noreply.github.com"

git config --global user.name "$NAME"
git config --global user.email "$EMAIL"

# Setting it globally is not enough on its own. A repo-local user.email
# always beats the global one, and this repo carried a placeholder
# (...@example.com) that quietly undid the fix for every commit made on a
# real machine — while the cloud runs, which clone fresh and so have no
# local config, looked correct. Two commits reached GitHub authored by an
# address that can never be linked to an account, and therefore counted
# for nothing, before anyone noticed. Write the local value too, so
# whichever level git consults it finds the same answer.
DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
if git -C "$DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$DIR" config --local user.name "$NAME"
  git -C "$DIR" config --local user.email "$EMAIL"
fi
