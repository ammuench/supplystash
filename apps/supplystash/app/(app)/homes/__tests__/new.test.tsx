import { PostgrestError } from "@supabase/supabase-js";
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, userEvent } from "@testing-library/react-native";
import { router } from "expo-router";

import NewHomeScreen from "@/app/(app)/homes/new";
import { HOME_NAME_MAX_LENGTH, HOME_NAME_TOO_LONG_MESSAGE } from "@/lib/schemas/home";
import { toastInfo } from "@/lib/toast";

// The screen is rendered on its own, outside a navigator: `Stack.Screen` only
// sets the header, and a successful create is asserted on `router.replace`.
jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
  Stack: { Screen: () => null },
}));

jest.mock("@/lib/toast", () => ({ toastInfo: jest.fn() }));

jest.mock("@/state/session", () => ({
  useSession: () => ({ user: { id: "user-me" } }),
}));

// Stands in for rpc("create_home", {...}).throwOnError(). `from` backs the
// homes list, which the hook refetches after a create; no test here reads it.
const mockRpcResult = jest.fn();
const mockRpc = jest.fn((_fn: string, _args: object) => ({ throwOnError: mockRpcResult }));
jest.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: (fn: string, args: object) => mockRpc(fn, args),
    from: () => ({
      select: () => ({ order: () => ({ throwOnError: () => Promise.resolve({ data: [] }) }) }),
    }),
  },
}));

const NEW_HOME_ID = "home-new";
const GENERIC_ERROR = "Couldn't create the home. Try again.";

const postgrestError = (code: string) =>
  new PostgrestError({ message: "developer-facing text", details: "", hint: "", code });

let client: QueryClient;

beforeEach(() => {
  jest.clearAllMocks();
  mockRpcResult.mockReset();
  mockRpcResult.mockResolvedValue({ data: NEW_HOME_ID });
  // `gcTime: Infinity` on both so no 5-minute gc timer outlives the test run.
  client = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false },
      mutations: { gcTime: Infinity },
    },
  });
});

afterEach(() => {
  client.clear();
  onlineManager.setOnline(true);
});

const renderScreen = () =>
  render(
    <QueryClientProvider client={client}>
      <NewHomeScreen />
    </QueryClientProvider>,
  );

const fillAndSubmit = async (name: string) => {
  const user = userEvent.setup();

  if (name) {
    await user.type(screen.getByLabelText("Home name"), name);
  }
  await user.press(screen.getByText("Create home"));
};

describe("# NewHomeScreen", () => {
  describe("## validation", () => {
    it("rejects an empty name and sends no request", async () => {
      renderScreen();

      await fillAndSubmit("");

      expect(screen.getByText("Enter a name for your home.")).toBeOnTheScreen();
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("rejects a name that is only spaces and sends no request", async () => {
      renderScreen();

      await fillAndSubmit("   ");

      expect(screen.getByText("Enter a name for your home.")).toBeOnTheScreen();
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("rejects a name over the maximum length and sends no request", async () => {
      renderScreen();

      await fillAndSubmit("a".repeat(HOME_NAME_MAX_LENGTH + 1));

      expect(screen.getByText(HOME_NAME_TOO_LONG_MESSAGE)).toBeOnTheScreen();
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  describe("## success", () => {
    it("sends the name trimmed", async () => {
      renderScreen();

      await fillAndSubmit("  Lake House  ");

      expect(mockRpc).toHaveBeenCalledWith("create_home", { p_name: "Lake House" });
    });

    // Replace, not push: Back from the new home must not return to this form.
    it("replaces this screen with the new home's details", async () => {
      renderScreen();

      await fillAndSubmit("Lake House");

      expect(router.replace).toHaveBeenCalledWith({
        pathname: "/homes/[homeId]",
        params: { homeId: NEW_HOME_ID },
      });
    });
  });

  describe("## server error", () => {
    it("shows a form-level message and does not navigate", async () => {
      mockRpcResult.mockRejectedValue(postgrestError("P0001"));
      renderScreen();

      await fillAndSubmit("Lake House");

      expect(await screen.findByText(GENERIC_ERROR)).toBeOnTheScreen();
      expect(router.replace).not.toHaveBeenCalled();
    });

    // The server's own message is written for developers.
    it("never shows the server's message text", async () => {
      mockRpcResult.mockRejectedValue(postgrestError("P0001"));
      renderScreen();

      await fillAndSubmit("Lake House");

      await screen.findByText(GENERIC_ERROR);
      expect(screen.queryByText("developer-facing text")).not.toBeOnTheScreen();
    });

    it("can be retried, and the message clears on success", async () => {
      mockRpcResult.mockRejectedValueOnce(postgrestError("P0001"));
      renderScreen();
      const user = userEvent.setup();

      await fillAndSubmit("Lake House");
      await screen.findByText(GENERIC_ERROR);
      await user.press(screen.getByText("Create home"));

      expect(mockRpc).toHaveBeenCalledTimes(2);
      expect(router.replace).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(GENERIC_ERROR)).not.toBeOnTheScreen();
    });

    // A fetch that throws has no code: the request never got an answer.
    it("names the connection when the request never reached the server", async () => {
      mockRpcResult.mockRejectedValue(new TypeError("Network request failed"));
      renderScreen();

      await fillAndSubmit("Lake House");

      expect(await screen.findByText("Can't reach the server. Try again.")).toBeOnTheScreen();
    });

    // Only reachable if the schema's limit and the database's drift apart.
    it("shows the length message when the database constraint refuses the name", async () => {
      mockRpcResult.mockRejectedValue(postgrestError("23514"));
      renderScreen();

      await fillAndSubmit("Lake House");

      expect(await screen.findByText(HOME_NAME_TOO_LONG_MESSAGE)).toBeOnTheScreen();
    });
  });

  describe("## while the request runs", () => {
    it("disables the button and says it is creating", async () => {
      let finish: (value: { data: string }) => void = () => {};
      mockRpcResult.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      renderScreen();

      await fillAndSubmit("Lake House");

      expect(await screen.findByText("Creating…")).toBeDisabled();

      finish({ data: NEW_HOME_ID });
      expect(await screen.findByText("Create home")).toBeEnabled();
    });
  });

  describe("## blocked", () => {
    // BlockedControl hides the real button from screen readers while blocked
    // and puts a cover over it that carries the reason.
    it("disables the button while offline and gives the reason", () => {
      onlineManager.setOnline(false);

      renderScreen();

      expect(screen.getByText("Create home", { includeHiddenElements: true })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Create home" })).toHaveProp(
        "accessibilityHint",
        "Cannot perform that action while app is offline.",
      );
    });

    it("sends no request when the blocked button is pressed", async () => {
      onlineManager.setOnline(false);
      renderScreen();
      const user = userEvent.setup();

      await user.type(screen.getByLabelText("Home name"), "Lake House");
      await user.press(screen.getByRole("button", { name: "Create home" }));

      expect(mockRpc).not.toHaveBeenCalled();
    });

    // The keyboard's Done key submits without going through the button, so the
    // button's cover does not stop it.
    it("sends no request and shows the reason when submitted from the keyboard", async () => {
      onlineManager.setOnline(false);
      renderScreen();
      const user = userEvent.setup();

      await user.type(screen.getByLabelText("Home name"), "Lake House", { submitEditing: true });

      expect(mockRpc).not.toHaveBeenCalled();
      expect(toastInfo).toHaveBeenCalledWith(
        "Cannot perform that action while app is offline.",
        expect.any(String),
      );
    });

    it("still submits from the keyboard while online", async () => {
      renderScreen();
      const user = userEvent.setup();

      await user.type(screen.getByLabelText("Home name"), "Lake House", { submitEditing: true });

      expect(mockRpc).toHaveBeenCalledWith("create_home", { p_name: "Lake House" });
    });
  });
});
