import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import type { BlockedAction } from "@/lib/blocked-reason";

import { BlockedControl } from "@/components/blocked-control";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { toastInfo } from "@/lib/toast";

jest.mock("@/lib/toast", () => ({
  toastInfo: jest.fn(),
}));

const OFFLINE_COPY = "Unable to perform that action, client offline.";

let client: QueryClient;
const onPress = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  // `gcTime: Infinity` so no 5-minute gc timer outlives the test run.
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
});

afterEach(() => {
  client.clear();
  onlineManager.setOnline(true);
});

const renderControl = (action: BlockedAction = "ledger-write") =>
  render(
    <QueryClientProvider client={client}>
      <BlockedControl action={action} label="Add item">
        {(disabled) => (
          <Button disabled={disabled} onPress={onPress}>
            <Text>Add</Text>
          </Button>
        )}
      </BlockedControl>
    </QueryClientProvider>,
  );

// Hidden from screen readers while blocked, so queries must opt in to find it.
// By text: role queries skip it even with the opt-in. `toBeDisabled()` checks
// ancestors, so the button's disabled state still counts.
const getChild = () => screen.getByText("Add", { includeHiddenElements: true });

describe("# BlockedControl", () => {
  describe("## connected", () => {
    it("passes presses through to the control", () => {
      renderControl();

      fireEvent.press(screen.getByRole("button", { name: "Add" }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("shows no cover", () => {
      renderControl();

      expect(screen.queryByLabelText("Add item")).toBeNull();
    });
  });

  describe("## offline", () => {
    it("disables the control before any tap", () => {
      renderControl();

      act(() => onlineManager.setOnline(false));

      expect(getChild()).toBeDisabled();
    });

    it("toasts the reason on tap instead of running the action", () => {
      renderControl();
      act(() => onlineManager.setOnline(false));

      fireEvent.press(screen.getByRole("button", { name: "Add item" }));

      expect(toastInfo).toHaveBeenCalledWith(OFFLINE_COPY, expect.any(String));
      expect(onPress).not.toHaveBeenCalled();
    });

    it("gives screen readers the reason as a hint", () => {
      renderControl();

      act(() => onlineManager.setOnline(false));

      expect(screen.getByRole("button", { name: "Add item" })).toHaveProp(
        "accessibilityHint",
        OFFLINE_COPY,
      );
    });

    it("hides the control itself from screen readers", () => {
      renderControl();

      act(() => onlineManager.setOnline(false));

      expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    });

    it("leaves the native check-off alone, since it queues", () => {
      renderControl("check-off");

      act(() => onlineManager.setOnline(false));
      fireEvent.press(screen.getByRole("button", { name: "Add" }));

      expect(onPress).toHaveBeenCalledTimes(1);
      expect(toastInfo).not.toHaveBeenCalled();
    });
  });

  it("re-enables the control when the connection returns", () => {
    renderControl();
    act(() => onlineManager.setOnline(false));

    act(() => onlineManager.setOnline(true));
    fireEvent.press(screen.getByRole("button", { name: "Add" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
