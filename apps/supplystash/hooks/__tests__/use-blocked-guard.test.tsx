import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";

import { useBlockedGuard } from "@/hooks/use-blocked-guard";
import { toastInfo } from "@/lib/toast";

jest.mock("@/lib/toast", () => ({ toastInfo: jest.fn() }));

const OFFLINE_COPY = "Cannot perform that action while app is offline.";

let client: QueryClient;
const run = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  // `gcTime: Infinity` so no 5-minute gc timer outlives the test run.
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
});

afterEach(() => {
  client.clear();
  onlineManager.setOnline(true);
});

const renderGuard = () =>
  renderHook(() => useBlockedGuard("membership"), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });

describe("# useBlockedGuard", () => {
  describe("## allowed", () => {
    it("runs the action and shows no toast", () => {
      const { result } = renderGuard();

      result.current(run);

      expect(run).toHaveBeenCalledTimes(1);
      expect(toastInfo).not.toHaveBeenCalled();
    });
  });

  describe("## blocked", () => {
    it("does not run the action and shows the reason", () => {
      onlineManager.setOnline(false);
      const { result } = renderGuard();

      result.current(run);

      expect(run).not.toHaveBeenCalled();
      expect(toastInfo).toHaveBeenCalledWith(OFFLINE_COPY, `blocked:${OFFLINE_COPY}`);
    });

    // The id is what makes a second tap replace the first toast.
    it("uses the same toast id every time", () => {
      onlineManager.setOnline(false);
      const { result } = renderGuard();

      result.current(run);
      result.current(run);

      const ids = jest.mocked(toastInfo).mock.calls.map(([, id]) => id);
      expect(ids).toEqual([`blocked:${OFFLINE_COPY}`, `blocked:${OFFLINE_COPY}`]);
    });
  });

  it("follows the connection as it changes", () => {
    const { result } = renderGuard();

    act(() => onlineManager.setOnline(false));
    result.current(run);
    expect(run).not.toHaveBeenCalled();

    act(() => onlineManager.setOnline(true));
    result.current(run);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
