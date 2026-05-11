// ABOUTME: Unit tests for the Settings Documents tab — static compliance documents list with download links

import { DocumentsTab } from "@/components/settings-documents";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

describe("DocumentsTab", () => {
  it("renders 4 document sections with titles", () => {
    render(<DocumentsTab />);
    expect(screen.getByText("Penetration test")).toBeDefined();
    expect(screen.getByText("SOC 2")).toBeDefined();
    expect(screen.getByText("DPA")).toBeDefined();
    expect(screen.getByText("Form W-9")).toBeDefined();
  });

  it("renders description text for each document", () => {
    render(<DocumentsTab />);
    expect(
      screen.getByText(/Penetration testing is performed at least annually/),
    ).toBeDefined();
    expect(screen.getByText(/SOC 2 is a compliance framework/)).toBeDefined();
    expect(screen.getByText(/Data Processing Agreement/)).toBeDefined();
    expect(screen.getByText(/Form W-9 is a tax document/)).toBeDefined();
  });

  it("renders Download links only for available documents", () => {
    render(<DocumentsTab />);
    const downloadLinks = screen.getAllByText("Download");
    expect(downloadLinks.length).toBe(2);
    expect(screen.getAllByText("Unavailable").length).toBe(2);
  });

  it("available download links point to /static/documents/ PDF paths", () => {
    const { container } = render(<DocumentsTab />);
    const links = container.querySelectorAll('a[href*="/static/documents/"]');
    expect(links.length).toBe(2);
    for (const link of links) {
      expect(link.getAttribute("href")).toMatch(/\.pdf$/);
    }
  });

  it("renders secondary description text for documents", () => {
    render(<DocumentsTab />);
    expect(screen.getByText(/Letter of Attestation/)).toBeDefined();
    expect(screen.getByText(/OpenSend-specific report/)).toBeDefined();
  });

  it("does not render Resend-branded placeholder copy", () => {
    const { container } = render(<DocumentsTab />);

    expect(container.textContent).not.toContain("Resend");
    expect(container.textContent).not.toContain("signup to");
  });
});
