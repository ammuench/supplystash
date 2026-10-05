import { render, screen } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";

import { useSession } from "@/state/session";

jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock("@/state/session", () => ({ useSession: jest.fn() }));

// The fragment snapshot is taken at module scope in lib/supabase.ts, before
// `detectSessionInUrl` can strip the hash, so the suite controls it from here
// rather than by writing to a `window.location` the client has already read.
// `exchangeCodeForSession` is only here to prove the screen never calls it.
jest.mock("@/lib/supabase", () => ({
  oauthErrorFromLaunchUrl: null,
  supabase: { auth: { exchangeCodeForSession: jest.fn() } },
}));

const mockParams = jest.mocked(useLocalSearchParams);
const mockSession = jest.mocked(useSession);

// Required because the mock above is a plain object: assigning to
// `oauthErrorFromLaunchUrl` needs the module read back, not the binding.
const launchUrl = jest.requireMock<{ oauthErrorFromLaunchUrl: unknown }>("@/lib/supabase");

// Imported after the mocks: the screen calls `maybeCompleteAuthSession` and
// reads the launch-URL snapshot at module scope.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AuthCallbackScreen = require("@/app/auth-callback").default as () => React.ReactElement;

const SESSION = { access_token: "header.payload.signature" };

describe("# AuthCallbackScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams.mockReturnValue({});
    launchUrl.oauthErrorFromLaunchUrl = null;
    mockSession.mockReturnValue({ session: null, user: null, isLoading: true });
  });

  it("waits while the session provider settles, rather than routing on its own", () => {
    render(<AuthCallbackScreen />);

    expect(screen.getByText("Finishing sign-in…")).toBeOnTheScreen();
    expect(router.replace).not.toHaveBeenCalled();
  });

  // This route sits outside both guarded layouts, so no layout gate will move it
  // along — without this the spinner outlives a perfectly good sign-in.
  it("leaves for the app once the session arrives", () => {
    mockSession.mockReturnValue({ session: SESSION, user: null, isLoading: false } as never);

    render(<AuthCallbackScreen />);

    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("stays put while a session is still loading, even if one is already set", () => {
    mockSession.mockReturnValue({ session: SESSION, user: null, isLoading: true } as never);

    render(<AuthCallbackScreen />);

    expect(router.replace).not.toHaveBeenCalled();
  });

  it("bounces a declined sign-in back to the form instead of spinning forever", () => {
    mockParams.mockReturnValue({ error: "access_denied" });

    render(<AuthCallbackScreen />);

    expect(router.replace).toHaveBeenCalledWith({
      pathname: "/sign-in",
      params: { authError: "access_denied" },
    });
  });

  // The whole reason the snapshot exists: an implicit-style error arrives in the
  // fragment, which `useLocalSearchParams` never sees, and the hash is gone by
  // the time this screen mounts.
  it("bounces an error that arrived in the fragment, not the query string", () => {
    launchUrl.oauthErrorFromLaunchUrl = { code: "cancelled", message: "User said no" };

    render(<AuthCallbackScreen />);

    expect(router.replace).toHaveBeenCalledWith({
      pathname: "/sign-in",
      params: { authError: "User said no" },
    });
  });

  // The bare code is machine wording; the provider's description is the only
  // part the user can read, so it must survive the bounce.
  it("carries the provider's own reason across, not just the error code", () => {
    mockParams.mockReturnValue({
      error: "access_denied",
      error_description: "User said no",
    });

    render(<AuthCallbackScreen />);

    expect(router.replace).toHaveBeenCalledWith({
      pathname: "/sign-in",
      params: { authError: "User said no" },
    });
  });

  // An error means no session is coming, but a stale one in the provider must
  // not win the race and strand the user in the app with no explanation.
  it("prefers the error bounce over a session that is already set", () => {
    mockParams.mockReturnValue({ error: "access_denied" });
    mockSession.mockReturnValue({ session: SESSION, user: null, isLoading: false } as never);

    render(<AuthCallbackScreen />);

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith({
      pathname: "/sign-in",
      params: { authError: "access_denied" },
    });
  });
});
