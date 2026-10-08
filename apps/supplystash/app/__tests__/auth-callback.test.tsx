import { render, screen, waitFor } from "@testing-library/react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { Platform } from "react-native";

import AuthCallbackScreen from "@/app/auth-callback";
import { completeOAuthCallback } from "@/lib/auth";

jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));

// The deep link that a native cold start arrives on. Null unless a test is
// standing one up — the web redirect never produces one.
jest.mock("expo-linking", () => ({ useLinkingURL: jest.fn(() => null) }));

jest.mock("@/lib/auth", () => ({ completeOAuthCallback: jest.fn() }));

const mockLinkingUrl = jest.mocked(Linking.useLinkingURL);
const mockComplete = jest.mocked(completeOAuthCallback);

const NATIVE_URL = "supply-stash://auth-callback?code=abc123";
const WEB_URL = "http://localhost:8081/auth-callback?code=abc123";

const SESSION = { access_token: "header.payload.signature" };

describe("# AuthCallbackScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLinkingUrl.mockReturnValue(NATIVE_URL);
    mockComplete.mockResolvedValue({ ok: true, data: { session: SESSION, user: null } } as never);
  });

  it("shows a spinner while the exchange is in flight", () => {
    // Never settles, so the assertion is made with the exchange genuinely
    // outstanding rather than in the gap before a resolved promise flushes.
    mockComplete.mockReturnValue(new Promise(() => {}));

    render(<AuthCallbackScreen />);

    expect(screen.getByText("Finishing sign-in…")).toBeOnTheScreen();
    expect(router.replace).not.toHaveBeenCalled();
  });

  // This route sits outside both guarded layouts, so no layout gate will move it
  // along — without this the spinner outlives a perfectly good sign-in.
  it("leaves for the app once the exchange succeeds", async () => {
    render(<AuthCallbackScreen />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });

  // A single-use code, so a re-render firing a second exchange would spend a
  // value GoTrue has already burned and turn a good sign-in into a failure.
  it("exchanges once, however often it re-renders", async () => {
    const { rerender } = render(<AuthCallbackScreen />);
    rerender(<AuthCallbackScreen />);
    rerender(<AuthCallbackScreen />);

    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    expect(mockComplete).toHaveBeenCalledTimes(1);
  });

  it("bounces with the reason when the exchange fails", async () => {
    mockComplete.mockResolvedValue({
      ok: false,
      error: { code: "unknown", message: "Code expired." },
    });

    render(<AuthCallbackScreen />);

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: "/sign-in",
        params: { authError: "Code expired." },
      }),
    );
  });

  // Backing out is not a failure to report — the sign-in screen's treatment of
  // `cancelled` everywhere else is to say nothing at all.
  it("bounces silently when the user backed out", async () => {
    mockComplete.mockResolvedValue({
      ok: false,
      error: { code: "cancelled", message: "Sign-in was cancelled." },
    });

    render(<AuthCallbackScreen />);

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({ pathname: "/sign-in", params: {} }),
    );
  });

  describe("## on native", () => {
    // `openAuthSessionAsync` is gone with the process that opened it, so
    // nothing exchanges the code unless this screen does.
    it("exchanges the code off the cold-start deep link", async () => {
      render(<AuthCallbackScreen />);

      await waitFor(() => expect(mockComplete).toHaveBeenCalledWith(NATIVE_URL));
    });

    it("does nothing until a deep link arrives", () => {
      mockLinkingUrl.mockReturnValue(null);

      render(<AuthCallbackScreen />);

      expect(mockComplete).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
    });
  });

  describe("## on web", () => {
    // `replaceProperty` mutates the real module object, so without an explicit
    // restore the "web" value leaks into every block declared after this one.
    let platform: ReturnType<typeof jest.replaceProperty>;
    const originalLocation = Object.getOwnPropertyDescriptor(globalThis.window, "location");

    beforeEach(() => {
      platform = jest.replaceProperty(Platform, "OS", "web");
      mockLinkingUrl.mockReturnValue(null);
      Object.defineProperty(globalThis.window, "location", {
        configurable: true,
        value: { href: WEB_URL },
      });
    });

    afterEach(() => {
      platform.restore();
      if (originalLocation) {
        Object.defineProperty(globalThis.window, "location", originalLocation);
      } else {
        // @ts-expect-error -- removing the stand-in this suite installed
        delete globalThis.window.location;
      }
    });

    // `detectSessionInUrl` is off, so the page's own URL is the only place the
    // code is ever read from — this screen is the exchange.
    it("exchanges the code off the page's own URL", async () => {
      render(<AuthCallbackScreen />);

      await waitFor(() => expect(mockComplete).toHaveBeenCalledWith(WEB_URL));
      await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    });
  });
});
