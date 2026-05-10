export const OPENSEND_GITHUB_REPO_URL = "https://github.com/namuh-eng/opensend";

const OPENSEND_GITHUB_REPO_API_URL =
  "https://api.github.com/repos/namuh-eng/opensend";
const GITHUB_STARS_REVALIDATE_SECONDS = 60 * 30;

export type GithubStars = {
  count: number;
  formattedCount: string;
};

function formatCompactCount(count: number, divisor: number, suffix: string) {
  const value = count / divisor;
  const rounded = value < 100 ? Math.round(value * 10) / 10 : Math.round(value);

  return `${String(rounded).replace(/\.0$/, "")}${suffix}`;
}

export function formatGithubStarCount(rawCount: number) {
  const count = Math.max(0, Math.floor(rawCount));

  if (count < 1_000) {
    return String(count);
  }

  if (count >= 999_500) {
    return formatCompactCount(count, 1_000_000, "M");
  }

  return formatCompactCount(count, 1_000, "k");
}

function parseGithubStarCount(payload: unknown) {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const { stargazers_count: starCount } = payload as {
    stargazers_count?: unknown;
  };

  if (
    typeof starCount !== "number" ||
    !Number.isFinite(starCount) ||
    starCount < 0
  ) {
    return null;
  }

  return Math.floor(starCount);
}

export async function getOpenSendGithubStars(): Promise<GithubStars | null> {
  try {
    const response = await fetch(OPENSEND_GITHUB_REPO_API_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "opensend-landing-page",
      },
      next: { revalidate: GITHUB_STARS_REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      return null;
    }

    const starCount = parseGithubStarCount(await response.json());

    if (starCount === null) {
      return null;
    }

    return {
      count: starCount,
      formattedCount: formatGithubStarCount(starCount),
    };
  } catch {
    return null;
  }
}
