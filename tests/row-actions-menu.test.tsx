import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    expect(screen.getByText("Permanently delete?")).toBeDefined();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
