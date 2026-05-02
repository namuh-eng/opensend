import { Sidebar } from "@/components/sidebar";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/emails",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: { user: { email: "e2e@example.com", name: "E2E" } },
    }),
    signOut: vi.fn(),
  },
}));

afterEach(cleanup);

describe("<Sidebar /> billing visibility", () => {
  it("hides the Billing entry when billing is disabled", () => {
    render(<Sidebar billingEnabled={false} />);
    expect(screen.queryByText("Billing")).toBeNull();
  });

  it("shows the Billing entry when billing is enabled", () => {
    render(<Sidebar billingEnabled={true} />);
    expect(screen.getByText("Billing")).toBeDefined();
  });
});
