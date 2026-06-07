#!/usr/bin/env bash

# create_worktree.sh - Create a new git worktree for OpenSend development.
#
# Usage:
#   ./hack/create_worktree.sh [worktree_name] [base_branch]
#   ./hack/create_worktree.sh origin/some-remote-branch
#
# - If no name is provided, a unique human-readable one is generated.
# - If no base branch is provided, the current branch is used.
# - base_branch may be a local branch or a remote ref (e.g. origin/fix-actions).
#
# Worktrees live under $HOME/wt/<repo> by default. Override the base with
# OPENSEND_WORKTREE_OVERRIDE_BASE.
#
# After creating the worktree this script:
#   - copies the .claude directory (agent config) if present
#   - symlinks every .env / .env.* file (except .env.example) from the main repo
#   - symlinks .mcp.json if present
#   - runs `bun install` so the worktree is ready to use
#
# Note: the dev server port comes from PORT in your symlinked .env (default
# 3015). Set PORT in the worktree's own .env (replace the symlink) if you want
# to run multiple dev servers at once.

set -euo pipefail

# Generate a unique, human-readable worktree name.
generate_unique_name() {
    local adjectives=("swift" "bright" "clever" "smooth" "quick" "clean" "sharp" "neat" "cool" "fast")
    local nouns=("fix" "task" "work" "dev" "patch" "branch" "code" "build" "test" "run")

    local adj=${adjectives[$RANDOM % ${#adjectives[@]}]}
    local noun=${nouns[$RANDOM % ${#nouns[@]}]}
    local timestamp
    timestamp=$(date +%H%M)

    echo "${adj}_${noun}_${timestamp}"
}

# Resolve worktree name + base branch from the arguments.
if [ $# -eq 1 ] && [[ "$1" == */* ]] && ! git show-ref --verify --quiet "refs/heads/$1"; then
    # Single argument that looks like a remote branch (e.g. origin/fix-actions).
    BASE_BRANCH="$1"
    WORKTREE_NAME="${1#*/}"  # e.g. fix-actions from origin/fix-actions
elif [ $# -ge 2 ]; then
    WORKTREE_NAME="$1"
    BASE_BRANCH="$2"
elif [ $# -eq 1 ]; then
    WORKTREE_NAME="$1"
    BASE_BRANCH=$(git branch --show-current)
else
    WORKTREE_NAME=$(generate_unique_name)
    BASE_BRANCH=$(git branch --show-current)
fi

# Run everything relative to the repo root so the script works from anywhere.
ORIGINAL_DIR=$(git rev-parse --show-toplevel)
cd "$ORIGINAL_DIR"
REPO_BASE_NAME=$(basename "$ORIGINAL_DIR")

if [ -n "${OPENSEND_WORKTREE_OVERRIDE_BASE:-}" ]; then
    WORKTREES_BASE="${OPENSEND_WORKTREE_OVERRIDE_BASE}/${REPO_BASE_NAME}"
else
    WORKTREES_BASE="$HOME/wt/${REPO_BASE_NAME}"
fi

# Branch names can contain '/' (e.g. fix/foo); flatten them for the directory.
WORKTREE_DIR_NAME="${WORKTREE_NAME//\//-}"
WORKTREE_PATH="${WORKTREES_BASE}/${WORKTREE_DIR_NAME}"

echo "🌳 Creating worktree: ${WORKTREE_NAME}"
echo "📁 Location: ${WORKTREE_PATH}"

if [ ! -d "$WORKTREES_BASE" ]; then
    echo "📁 Creating worktrees base directory: $WORKTREES_BASE"
    mkdir -p "$WORKTREES_BASE"
fi

if [ -d "$WORKTREE_PATH" ]; then
    echo "❌ Error: Worktree directory already exists: $WORKTREE_PATH"
    exit 1
fi

# Clean up any stale registration pointing at this path.
if git worktree list --porcelain | grep -q "^worktree $WORKTREE_PATH$"; then
    echo "🧹 Cleaning up stale worktree registration..."
    git worktree remove --force "$WORKTREE_PATH" 2>/dev/null || git worktree prune
fi

echo "🔀 Creating from branch: ${BASE_BRANCH}"

LOCAL_BRANCH_NAME="$WORKTREE_NAME"

# Treat BASE_BRANCH as a remote ref only when no local branch by that name
# exists (local branches commonly contain '/', e.g. chore/foo).
if [[ "$BASE_BRANCH" == */* ]] && ! git show-ref --verify --quiet "refs/heads/${BASE_BRANCH}"; then
    REMOTE_BRANCH="$BASE_BRANCH"
    REMOTE_NAME="${BASE_BRANCH%%/*}"
    BRANCH_NAME_ONLY="${BASE_BRANCH#*/}"

    echo "🌐 Detected remote branch: ${REMOTE_BRANCH}"
    echo "📥 Fetching remote branch..."
    git fetch "$REMOTE_NAME" "$BRANCH_NAME_ONLY" || git fetch --all

    if ! git show-ref --verify --quiet "refs/remotes/${REMOTE_BRANCH}"; then
        echo "❌ Error: Remote branch ${REMOTE_BRANCH} does not exist"
        exit 1
    fi

    if git show-ref --verify --quiet "refs/heads/${LOCAL_BRANCH_NAME}"; then
        echo "📋 Using existing local branch: ${LOCAL_BRANCH_NAME}"
        git worktree add "$WORKTREE_PATH" "$LOCAL_BRANCH_NAME"
    else
        echo "🆕 Creating local branch ${LOCAL_BRANCH_NAME} from ${REMOTE_BRANCH}"
        git worktree add -b "$LOCAL_BRANCH_NAME" "$WORKTREE_PATH" "$REMOTE_BRANCH"
        git -C "$WORKTREE_PATH" branch --set-upstream-to="$REMOTE_BRANCH" "$LOCAL_BRANCH_NAME" 2>/dev/null || true
    fi
else
    if git show-ref --verify --quiet "refs/heads/${LOCAL_BRANCH_NAME}"; then
        echo "📋 Using existing branch: ${LOCAL_BRANCH_NAME}"
        git worktree add "$WORKTREE_PATH" "$LOCAL_BRANCH_NAME"
    else
        echo "🆕 Creating new branch: ${LOCAL_BRANCH_NAME}"
        git worktree add -b "$LOCAL_BRANCH_NAME" "$WORKTREE_PATH" "$BASE_BRANCH"
    fi
fi

# Copy agent config so the worktree behaves like the main checkout.
for agent_dir in .claude .codex .agents; do
    if [ -d "$agent_dir" ]; then
        echo "📋 Copying ${agent_dir} directory..."
        cp -r "$agent_dir" "$WORKTREE_PATH/"
    fi
done

# Symlink every .env / .env.* file (except .env.example) from the main repo so
# secrets live in exactly one place.
while IFS= read -r env_file; do
    rel_path="${env_file#"${ORIGINAL_DIR}"/}"
    target_dir="${WORKTREE_PATH}/$(dirname "$rel_path")"
    mkdir -p "$target_dir"
    rm -f "${WORKTREE_PATH}/${rel_path}"
    ln -s "${env_file}" "${WORKTREE_PATH}/${rel_path}"
    echo "🔗 Symlinked ${rel_path}"
done < <(find "${ORIGINAL_DIR}" \( -name ".env" -o -name ".env.*" \) \
    ! -name ".env.example" ! -path "*/.git/*" ! -path "*/node_modules/*")

# Symlink .mcp.json if the main repo has one.
if [ -f "${ORIGINAL_DIR}/.mcp.json" ]; then
    rm -f "${WORKTREE_PATH}/.mcp.json"
    ln -s "${ORIGINAL_DIR}/.mcp.json" "${WORKTREE_PATH}/.mcp.json"
    echo "🔗 Symlinked .mcp.json"
fi

# Install dependencies. Bail (and clean up) if install fails so we never leave a
# broken worktree behind.
echo "🔧 Installing dependencies (bun install)..."
if ! (cd "$WORKTREE_PATH" && bun install); then
    echo "❌ bun install failed. Cleaning up worktree..."
    git worktree remove --force "$WORKTREE_PATH"
    git branch -D "$LOCAL_BRANCH_NAME" 2>/dev/null || true
    exit 1
fi

echo ""
echo "✅ Worktree created successfully!"
echo "📁 Path: ${WORKTREE_PATH}"
echo "🔀 Branch: ${LOCAL_BRANCH_NAME}"
echo ""
echo "To work in this worktree:"
echo "  cd ${WORKTREE_PATH}"
echo "  bun run dev"
echo ""
echo "To remove this worktree later:"
echo "  ./hack/cleanup_worktree.sh ${WORKTREE_DIR_NAME}"
