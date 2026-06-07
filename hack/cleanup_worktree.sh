#!/usr/bin/env bash
set -euo pipefail

# cleanup_worktree.sh - Remove an OpenSend git worktree and (optionally) its branch.
#
# Usage:
#   ./hack/cleanup_worktree.sh [worktree_name_or_path]
#
# With no argument, lists the worktrees available to clean up.
#
# Worktrees are expected under $HOME/wt/<repo> (override with
# OPENSEND_WORKTREE_OVERRIDE_BASE). A name (e.g. swift_fix_1430) or an absolute
# path both work.

REPO_BASE_NAME=$(basename "$(git rev-parse --show-toplevel)")
if [ -n "${OPENSEND_WORKTREE_OVERRIDE_BASE:-}" ]; then
    WORKTREE_BASE_DIR="${OPENSEND_WORKTREE_OVERRIDE_BASE}/${REPO_BASE_NAME}"
else
    WORKTREE_BASE_DIR="$HOME/wt/${REPO_BASE_NAME}"
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

list_worktrees() {
    echo -e "${YELLOW}Available worktrees:${NC}"
    git worktree list | grep -E "^${WORKTREE_BASE_DIR}" || {
        echo "No worktrees found in $WORKTREE_BASE_DIR"
        return 1
    }
}

cleanup_worktree() {
    local worktree_arg="$1"
    local worktree_path
    if [[ "$worktree_arg" == /* ]]; then
        worktree_path="$worktree_arg"
    else
        worktree_path="$WORKTREE_BASE_DIR/${worktree_arg}"
    fi

    # Canonicalize so matching survives symlinked path prefixes
    # (e.g. macOS maps /tmp -> /private/tmp).
    if [ -d "$worktree_path" ]; then
        worktree_path="$(cd "$worktree_path" && pwd -P)"
    fi

    if ! git worktree list --porcelain | grep -qxF "worktree $worktree_path"; then
        echo -e "${RED}Error: Worktree not found at $worktree_path${NC}"
        echo ""
        list_worktrees || true
        exit 1
    fi

    # The branch name comes from the worktree itself, not the directory name,
    # since the directory may have flattened slashes (fix/foo -> fix-foo).
    local branch_name
    branch_name="$(git -C "$worktree_path" branch --show-current 2>/dev/null || true)"

    echo -e "${YELLOW}Cleaning up worktree: $worktree_path${NC}"

    # Stop any dev server still running out of this worktree (best effort).
    local pids
    pids="$(pgrep -f "next.*${worktree_path}" 2>/dev/null || true)"
    if [ -n "${pids:-}" ]; then
        echo "Stopping dev server (pids $pids)..."
        # shellcheck disable=SC2086
        kill $pids 2>/dev/null || true
    fi

    echo "Removing git worktree..."
    if git worktree remove --force "$worktree_path"; then
        echo -e "${GREEN}✓ Worktree removed successfully${NC}"
    else
        echo -e "${RED}Error: Failed to remove worktree${NC}"
        echo "The worktree might be in an inconsistent state. Try:"
        echo "  rm -rf $worktree_path"
        echo "  git worktree prune"
        exit 1
    fi

    if [ -n "${branch_name:-}" ]; then
        echo ""
        read -p "Delete the branch '$branch_name'? (y/N) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if git branch -D "$branch_name" 2>/dev/null; then
                echo -e "${GREEN}✓ Branch deleted${NC}"
            else
                echo -e "${YELLOW}Branch might not exist or already deleted${NC}"
            fi
        else
            echo "Branch kept: $branch_name"
        fi
    fi

    echo "Pruning worktree references..."
    git worktree prune

    echo ""
    echo -e "${GREEN}✓ Cleanup complete!${NC}"
}

if [ $# -eq 0 ]; then
    list_worktrees || exit 1
    echo ""
    echo "Usage: $0 <worktree_name>"
    echo "Example: $0 swift_fix_1430"
    echo "Example: $0 /path/to/worktree"
else
    cleanup_worktree "$1"
fi
