#!/usr/bin/env bash
# ABOUTME: Post-install prompt to optionally star the GitHub repo via gh CLI.
# ABOUTME: Three guard gates (skip flag/env, TTY, gh auth). Never fails the install.

OWNER="namuh-eng"
REPO="opensend"
PROJECT="opensend"

main() {
  # --- Guard Gate 1: Skip flags ---
  for arg in "$@"; do
    if [ "$arg" = "--skip-star-prompt" ]; then
      return 0
    fi
  done

  if [ "${SKIP_STAR_PROMPT:-}" = "1" ] || [ "${OPENSEND_SKIP_STAR_PROMPT:-}" = "1" ]; then
    return 0
  fi

  # --- Guard Gate 2: Interactive TTY ---
  if [ "${__FORCE_INTERACTIVE:-}" != "1" ]; then
    if [ ! -t 0 ] || [ ! -t 1 ]; then
      return 0
    fi
  fi

  # --- Guard Gate 3: gh installed and authenticated ---
  local gh_cmd="${GH_CMD:-gh}"

  if ! command -v "$gh_cmd" &>/dev/null; then
    return 0
  fi

  if ! "$gh_cmd" auth status &>/dev/null; then
    return 0
  fi

  # --- Prompt ---
  printf "\n[%s] optional: star %s/%s on GitHub to support the project\n" "$PROJECT" "$OWNER" "$REPO"
  printf "[%s] Would you like to star %s/%s on GitHub with gh? [y/N]: " "$PROJECT" "$OWNER" "$REPO"

  read -r answer

  case "$(printf '%s' "$answer" | tr '[:upper:]' '[:lower:]')" in
    y|yes)
      if "$gh_cmd" api --method PUT "/user/starred/${OWNER}/${REPO}" --silent 2>/dev/null; then
        printf "[%s] Thanks for starring %s/%s!\n" "$PROJECT" "$OWNER" "$REPO"
      else
        printf "[%s] No worries — continuing without it.\n" "$PROJECT"
      fi
      ;;
    *)
      # Default is No — skip silently
      ;;
  esac
}

# Never fail the install — catch all errors
main "$@" || true
