import { onlineManager } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";

import { useIsOnline } from "@/hooks/use-is-online";

afterEach(() => {
  onlineManager.setOnline(true);
});

describe("# useIsOnline", () => {
  it("is online by default", () => {
    const { result } = renderHook(() => useIsOnline());

    expect(result.current).toBe(true);
  });

  it("re-renders when the connection drops and comes back", () => {
    const { result } = renderHook(() => useIsOnline());

    act(() => onlineManager.setOnline(false));
    expect(result.current).toBe(false);

    act(() => onlineManager.setOnline(true));
    expect(result.current).toBe(true);
  });

  it("keeps updating one screen after another screen using it unmounts", () => {
    // Two screens mounted at once, like two tabs.
    const first = renderHook(() => useIsOnline());
    const second = renderHook(() => useIsOnline());

    first.unmount();
    act(() => onlineManager.setOnline(false));

    expect(second.result.current).toBe(false);
  });

  it("removes its listener once unmounted", () => {
    // Nothing else in this suite subscribes, so these are the hook's alone.
    const first = renderHook(() => useIsOnline());
    const second = renderHook(() => useIsOnline());

    first.unmount();
    expect(onlineManager.hasListeners()).toBe(true);

    second.unmount();
    expect(onlineManager.hasListeners()).toBe(false);
  });

  it("starts offline when the app is already offline at mount", () => {
    onlineManager.setOnline(false);

    const { result } = renderHook(() => useIsOnline());

    expect(result.current).toBe(false);
  });
});
