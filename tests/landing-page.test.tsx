import LandingPage, { metadata } from "@/app/landing/page";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : String(href)} {...props}>
      {children}
    </a>
  ),
}));

describe("Landing page metadata", () => {
  it("exposes a marketing-friendly title and description", () => {
    expect(metadata.title).toMatch(/OpenSend/);
    expect(typeof metadata.description).toBe("string");
    expect((metadata.description as string).length).toBeGreaterThan(40);
  });

  it("declares OpenGraph + canonical metadata for SEO", () => {
    expect(metadata.openGraph?.title).toMatch(/OpenSend/);
    expect(metadata.openGraph?.url).toBe("https://opensend.namuh.co");
    expect(metadata.alternates?.canonical).toBe(
      "https://opensend.namuh.co/landing",
    );
  });
});

describe("Landing page route", () => {
  it("renders the hero headline", () => {
    render(<LandingPage />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toMatch(/open-source email API/i);
  });

  it("renders all required marketing CTAs", () => {
    render(<LandingPage />);

    const selfHost = screen
      .getAllByText(/self-host/i)
      .find((el) => el.getAttribute("data-testid") === "cta-self-host");
    expect(selfHost?.getAttribute("href")).toMatch(/github\.com/);

    const hosted = screen.getByTestId("cta-hosted");
    expect(hosted.getAttribute("href")).toBe("/auth");

    const github = screen.getByTestId("cta-github");
    expect(github.getAttribute("href")).toMatch(/github\.com/);
  });

  it("links to docs and GitHub from header navigation", () => {
    render(<LandingPage />);
    const docsLinks = screen.getAllByRole("link", { name: "Docs" });
    expect(docsLinks.some((el) => el.getAttribute("href") === "/docs")).toBe(
      true,
    );

    const githubLinks = screen.getAllByRole("link", { name: "GitHub" });
    expect(
      githubLinks.some((el) =>
        (el.getAttribute("href") ?? "").includes("github.com"),
      ),
    ).toBe(true);
  });

  it("renders a footer with copyright and license attribution", () => {
    render(<LandingPage />);
    expect(screen.getByText(/Elastic License 2\.0/i)).toBeDefined();
  });

  it("includes a self-host quickstart code block", () => {
    render(<LandingPage />);
    expect(screen.getByText(/docker compose up -d/i)).toBeDefined();
  });
});
