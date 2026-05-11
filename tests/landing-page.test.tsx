import { metadata } from "@/app/landing/page";
import { LandingPage } from "@/components/landing/landing-page";
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

vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
    width,
    height,
    priority: _priority,
    sizes: _sizes,
    ...props
  }: {
    alt: string;
    src: string;
    width: number;
    height: number;
    priority?: boolean;
    sizes?: string;
  }) => <img {...props} alt={alt} src={src} width={width} height={height} />,
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
    expect(metadata.alternates?.canonical).toBe("https://opensend.namuh.co/");
  });
});

describe("Landing page route", () => {
  it("renders the hero headline", () => {
    render(<LandingPage />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toMatch(/email infrastructure/i);
    expect(heading.textContent).toMatch(/open by default/i);
  });

  it("renders all required marketing CTAs", () => {
    render(<LandingPage />);

    const selfHost = screen.getByTestId("cta-self-host");
    expect(selfHost.getAttribute("href")).toMatch(/github\.com/);

    const hosted = screen.getByTestId("cta-hosted");
    expect(hosted.getAttribute("href")).toBe("/auth");

    const github = screen.getByTestId("cta-github");
    expect(github.getAttribute("href")).toMatch(/github\.com/);

    const navSignIn = screen.getByTestId("nav-sign-in");
    expect(navSignIn.getAttribute("href")).toBe("/auth");
  });

  it("links to docs and GitHub from header navigation", () => {
    render(
      <LandingPage githubStars={{ count: 1_234, formattedCount: "1.2k" }} />,
    );
    const docsLinks = screen.getAllByRole("link", { name: "Docs" });
    expect(docsLinks.some((el) => el.getAttribute("href") === "/docs")).toBe(
      true,
    );

    const githubLink = screen.getByTestId("nav-github");
    expect(githubLink.textContent).toContain("Star on GitHub");
    expect(githubLink.textContent).toContain("1.2k stars");
    expect(githubLink.getAttribute("href")).toContain(
      "github.com/namuh-eng/opensend",
    );
  });

  it("keeps the GitHub nav render safe when the live star count is unavailable", () => {
    render(<LandingPage githubStars={null} />);

    const githubLink = screen.getByTestId("nav-github");
    expect(githubLink.textContent).toBe("Star on GitHub");
    expect(githubLink.getAttribute("href")).toContain(
      "github.com/namuh-eng/opensend",
    );
  });

  it("renders the dev-focused landing sections", () => {
    render(<LandingPage />);

    expect(screen.getByLabelText(/TypeScript SDK code sample/i)).toBeDefined();
    expect(
      screen.getByRole("heading", { name: /none of the lock-in/i }),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { name: /cloud, or yours/i }),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { name: /shipping in public/i }),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { name: /stop renting your/i }),
    ).toBeDefined();
  });

  it("renders a footer with license attribution", () => {
    render(<LandingPage />);
    expect(screen.getAllByText(/ELv2/i).length).toBeGreaterThan(0);
  });

  it("includes a self-host quickstart code block", () => {
    render(<LandingPage />);
    expect(screen.getAllByText(/docker compose up -d/i).length).toBeGreaterThan(
      0,
    );
  });
});
