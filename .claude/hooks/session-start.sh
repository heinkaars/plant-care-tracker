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
git config --global user.name "heinkaars"
git config --global user.email "219910040+heinkaars@users.noreply.github.com"
