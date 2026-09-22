import { render, screen } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";

import AuthCallbackScreen from "@/app/auth-callback";
import { supabase } from "@/lib/supabase";

jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

// Only here to prove the screen never touches it.
jest.mock("@/lib/supabase", () => ({ supabase: { auth: { setSession: jest.fn() } } }));

const mockParams = jest.mocked(useLocalSearchParams);

describe("# AuthCallbackScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams.mockReturnValue({});
  });

  it("waits while the session provider settles, rather than routing on its own", () => {
    render(<AuthCallbackScreen />);

    expect(screen.getByText("Finishing sign-in…")).toBeOnTheScreen();
    expect(router.replace).not.toHaveBeenCalled();
  });

  // GoTrue has already consumed the fragment by the time this mounts, so a
  // setSession here would race it for tokens that are already spent.
  it("never sets the session itself", () => {
    mockParams.mockReturnValue({ access_token: "header.payload.signature" });

    render(<AuthCallbackScreen />);

    expect(supabase.auth.setSession).not.toHaveBeenCalled();
  });

  it("bounces a declined sign-in back to the form instead of spinning forever", () => {
    mockParams.mockReturnValue({ error: "access_denied" });

    render(<AuthCallbackScreen />);

    expect(router.replace).toHaveBeenCalledWith("/sign-in");
  });
});
