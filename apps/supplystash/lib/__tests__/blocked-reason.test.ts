import { type BlockedAction, getBlockedReason } from "@/lib/blocked-reason";

const ONLINE_ONLY: BlockedAction[] = ["ledger-write", "membership", "barcode", "photo", "history"];

const OFFLINE = /while app is offline/;
const UNREACHABLE = /server unreachable/;

const connected = { isOnline: true, isUnreachable: false };
const offline = { isOnline: false, isUnreachable: false };
const unreachable = { isOnline: true, isUnreachable: true };

describe("# getBlockedReason", () => {
  describe.each([false, true])("## isWeb: %s", (isWeb) => {
    describe.each(ONLINE_ONLY)("### %s", (action) => {
      it("is not blocked when connected", () => {
        expect(getBlockedReason(action, { ...connected, isWeb })).toEqual({ blocked: false });
      });

      it("is blocked offline", () => {
        expect(getBlockedReason(action, { ...offline, isWeb })).toEqual({
          blocked: true,
          reason: expect.stringMatching(OFFLINE),
        });
      });

      it("is blocked when the server is unreachable", () => {
        expect(getBlockedReason(action, { ...unreachable, isWeb })).toEqual({
          blocked: true,
          reason: expect.stringMatching(UNREACHABLE),
        });
      });
    });

    describe("### check-off", () => {
      it("is not blocked when connected", () => {
        expect(getBlockedReason("check-off", { ...connected, isWeb })).toEqual({
          blocked: false,
        });
      });

      it("is blocked when the server is unreachable", () => {
        // Online, so the write would fire and fail rather than queue.
        expect(getBlockedReason("check-off", { ...unreachable, isWeb })).toEqual({
          blocked: true,
          reason: expect.stringMatching(UNREACHABLE),
        });
      });
    });
  });

  describe("## check-off offline", () => {
    it("is not blocked on native, where it queues", () => {
      expect(getBlockedReason("check-off", { ...offline, isWeb: false })).toEqual({
        blocked: false,
      });
    });

    it("is blocked on web, which persists nothing", () => {
      expect(getBlockedReason("check-off", { ...offline, isWeb: true })).toEqual({
        blocked: true,
        reason: expect.stringMatching(OFFLINE),
      });
    });
  });

  it("names offline, not the server, when both are true", () => {
    // Going offline pauses queries but keeps their last error.
    expect(
      getBlockedReason("ledger-write", { isOnline: false, isUnreachable: true, isWeb: false }),
    ).toEqual({ blocked: true, reason: expect.stringMatching(OFFLINE) });
  });
});
