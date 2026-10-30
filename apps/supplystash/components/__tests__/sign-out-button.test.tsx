import { PortalHost } from "@rn-primitives/portal";
import { render, screen, userEvent } from "@testing-library/react-native";

import { SignOutButton } from "@/components/sign-out-button";
import { signOut } from "@/lib/auth";
import { countPausedMutations } from "@/lib/query-client";

// The dialog's enter/exit animations import reanimated, whose native worklets
// runtime does not exist under jest (its own mock still loads it). Only the
// pieces the dialog touches are stubbed: builder chains that return
// themselves, and animated components that render as plain ones.
jest.mock("react-native-reanimated", () => {
  const { Pressable, View } = jest.requireActual<typeof import("react-native")>("react-native");
  const animation: Record<string, unknown> = {};
  for (const step of ["duration", "delay", "reduceMotion"]) {
    animation[step] = () => animation;
  }

  return {
    __esModule: true,
    default: { View, createAnimatedComponent: () => Pressable },
    FadeIn: animation,
    FadeOut: animation,
    ReduceMotion: { System: "system" },
  };
});

jest.mock("@/lib/auth", () => ({ signOut: jest.fn() }));

jest.mock("@/lib/query-client", () => ({
  countPausedMutations: jest.fn(),
  queryClient: {},
}));

jest.mock("@/lib/toast", () => ({
  toastError: jest.fn(),
  toastSuccess: jest.fn(),
}));

const mockSignOut = jest.mocked(signOut);
const mockCountQueued = jest.mocked(countPausedMutations);

// The dialog portals out of the button, as under app/_layout.tsx.
const renderButton = () =>
  render(
    <>
      <SignOutButton />
      <PortalHost />
    </>,
  );

describe("# SignOutButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignOut.mockResolvedValue({ ok: true, data: null });
    mockCountQueued.mockReturnValue(0);
  });

  describe("## press", () => {
    it("signs out straight away when nothing is queued", async () => {
      const user = userEvent.setup();
      renderButton();

      await user.press(screen.getByText("Log Out"));

      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("Discard unsynced changes?")).not.toBeOnTheScreen();
    });

    it("asks first, with the count, when changes are still queued", async () => {
      mockCountQueued.mockReturnValue(2);
      const user = userEvent.setup();
      renderButton();

      await user.press(screen.getByText("Log Out"));

      expect(screen.getByText("Discard unsynced changes?")).toBeOnTheScreen();
      expect(
        screen.getByText("2 changes haven't synced yet and will be lost if you log out."),
      ).toBeOnTheScreen();
      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it("uses the singular for one queued change", async () => {
      mockCountQueued.mockReturnValue(1);
      const user = userEvent.setup();
      renderButton();

      await user.press(screen.getByText("Log Out"));

      expect(
        screen.getByText("1 change hasn't synced yet and will be lost if you log out."),
      ).toBeOnTheScreen();
    });

    it("stays signed in when the user cancels", async () => {
      mockCountQueued.mockReturnValue(1);
      const user = userEvent.setup();
      renderButton();

      await user.press(screen.getByText("Log Out"));
      await user.press(screen.getByText("Cancel"));

      expect(mockSignOut).not.toHaveBeenCalled();
      expect(screen.queryByText("Discard unsynced changes?")).not.toBeOnTheScreen();
    });

    it("signs out once the user confirms the loss", async () => {
      mockCountQueued.mockReturnValue(1);
      const user = userEvent.setup();
      renderButton();

      await user.press(screen.getByText("Log Out"));
      await user.press(screen.getByText("Log out anyway"));

      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });
});
