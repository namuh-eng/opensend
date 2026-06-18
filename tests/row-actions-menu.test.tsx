import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RowActionsMenu } from "@/components/row-actions-menu";

afterEach(() => {
  cleanup();
});

describe("RowActionsMenu", () => {
  it("opens the menu and runs a non-destructive action", () => {
    const onSelect = vi.fn();
    render(<RowActionsMenu actions={[{ label: "View / edit", onSelect }]} />);

    // Menu is closed initially
    expect(screen.queryByText("View / edit")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByText("View / edit"));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("confirms before running the delete action", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <RowActionsMenu
        deleteAction={{
          label: "Delete segment",
          confirmText: "Permanently delete?",
          onConfirm,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByText("Delete segment"));

    // Confirm dialog appears; onConfirm not called yet
    const dialog = screen.getByRole("dialog", { name: "Delete segment" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("Permanently delete?")).toBeDefined();
    expect(onConfirm).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Cancel" }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("keeps the trigger visible on keyboard focus and closes confirm with Escape", async () => {
    render(
      <RowActionsMenu
        deleteAction={{
          label: "Delete segment",
          confirmText: "Permanently delete?",
          onConfirm: vi.fn().mockResolvedValue(undefined),
        }}
      />,
    );

    const trigger = screen.getByRole("button", { name: "More actions" });
    expect(trigger.className).toContain("focus:opacity-100");
    expect(trigger.className).toContain("group-focus-within:opacity-100");

    fireEvent.click(trigger);
    fireEvent.click(screen.getByText("Delete segment"));
    expect(
      screen.getByRole("dialog", { name: "Delete segment" }),
    ).toBeDefined();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Delete segment" }),
      ).toBeNull();
    });
  });
});
