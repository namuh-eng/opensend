import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindFirst = vi.fn();
const mockFindEmailFirst = vi.fn();
const mockInsertValues = vi.fn();
const mockInsertReturning = vi.fn();
const mockOnConflictDoNothing = vi.fn();
const mockUpdateWhere = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdate = vi.fn();
const mockTransaction = vi.fn();

vi.mock("../packages/core/src/db/client", () => ({
  db: {
    query: {
      emailEvents: {
        findFirst: mockFindFirst,
      },
      emails: {
        findFirst: mockFindEmailFirst,
      },
    },
    transaction: mockTransaction,
  },
}));

describe("packages/core emailEventRepo.create", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockFindEmailFirst.mockResolvedValue(null);
    mockInsertValues.mockReturnValue({
      returning: mockInsertReturning,
      onConflictDoNothing: mockOnConflictDoNothing,
    });
    mockUpdateWhere.mockResolvedValue(undefined);
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockOnConflictDoNothing.mockReturnValue({ returning: mockInsertReturning });

    mockTransaction.mockImplementation(async (callback) =>
      callback({
        insert: () => ({
          values: mockInsertValues,
        }),
        update: mockUpdate,
      }),
    );
  });

  it("updates the parent email status when a delivered event is recorded", async () => {
    const event = {
      id: "evt_1",
      emailId: "email_1",
      type: "delivered",
      payload: { smtpResponse: "250 ok" },
    };
    mockInsertReturning.mockResolvedValue([event]);

    const { emailEventRepo } = await import(
      "../packages/core/src/db/repositories/emailEventRepo"
    );

    const result = await emailEventRepo.create(event);

    expect(result).toEqual(event);
    expect(mockInsertValues).toHaveBeenCalledWith(event);
    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockUpdateSet).toHaveBeenCalledWith({ status: "delivered" });
    expect(mockUpdateWhere).toHaveBeenCalledOnce();
  });

  it("does not update the parent email status for non-terminal events", async () => {
    const event = {
      id: "evt_2",
      emailId: "email_1",
      type: "opened",
      payload: { ipAddress: "127.0.0.1" },
    };
    mockInsertReturning.mockResolvedValue([event]);

    const { emailEventRepo } = await import(
      "../packages/core/src/db/repositories/emailEventRepo"
    );

    const result = await emailEventRepo.create(event);

    expect(result).toEqual(event);
    expect(mockInsertValues).toHaveBeenCalledWith(event);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("derives userId from the parent email when callers omit it", async () => {
    const event = {
      id: "evt_derived",
      emailId: "email_1",
      type: "delivered",
      payload: { smtpResponse: "250 ok" },
    };
    mockFindEmailFirst.mockResolvedValue({ userId: "user-1" });
    mockInsertReturning.mockResolvedValue([{ ...event, userId: "user-1" }]);

    const { emailEventRepo } = await import(
      "../packages/core/src/db/repositories/emailEventRepo"
    );

    await emailEventRepo.create(event);

    expect(mockFindEmailFirst).toHaveBeenCalledOnce();
    expect(mockInsertValues).toHaveBeenCalledWith({
      ...event,
      userId: "user-1",
    });
  });

  it("returns the existing event when a source id hits the duplicate guard", async () => {
    const existingEvent = {
      id: "evt_3",
      emailId: "email_1",
      sourceId: "sns-msg-1",
      type: "delivered",
      payload: { smtpResponse: "250 ok" },
    };
    mockInsertReturning.mockResolvedValue([]);
    mockFindFirst.mockResolvedValue(existingEvent);

    const { emailEventRepo } = await import(
      "../packages/core/src/db/repositories/emailEventRepo"
    );

    const result = await emailEventRepo.createOrIgnoreDuplicate(existingEvent);

    expect(result).toEqual({ event: existingEvent, created: false });
    expect(mockOnConflictDoNothing).toHaveBeenCalledOnce();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
