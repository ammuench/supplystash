// React Navigation's default bar is 49pt, which leaves the icon pill and label
// touching the edges. Shared so that anything that must clear the bar (bottom
// toasts) uses the same number the bar is drawn with. The bottom safe-area
// inset is not included.
export const TAB_BAR_HEIGHT = 60;
