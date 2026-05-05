import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPush, mockSignOut, mockUseSession } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockSignOut: vi.fn(),
  mockUseSession: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/emails",
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signOut: mockSignOut,
    useSession: mockUseSession,
  },
}));

import { Sidebar } from "@/components/sidebar";

type SignOutResult = {
  data: { success: boolean } | null;
  error: { message?: string; status: number; statusText: string } | null;
};

describe("Sidebar logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({
      data: {
        user: {
          email: "jaeyunha@example.com",
          name: "Jaeyun Ha",
        },
      },
    });
  });

  afterEach(cleanup);

  it("renders with a session, signs out, and redirects to auth on success", async () => {
    let resolveSignOut: (value: SignOutResult) => void = () => undefined;
    mockSignOut.mockReturnValue(
      new Promise<SignOutResult>((resolve) => {
        resolveSignOut = resolve;
      }),
    );

    render(<Sidebar />);

    expect(screen.getByText("jaeyunha@example.com")).toBeTruthy();
    const signOutButton = screen.getByRole("button", { name: "Sign out" });

    await userEvent.click(signOutButton);

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(signOutButton.getAttribute("disabled")).toBe("");
    expect(signOutButton.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("button", { name: "Signing out..." })).toBeTruthy();

    resolveSignOut({ data: { success: true }, error: null });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/auth");
    });
  });
});
