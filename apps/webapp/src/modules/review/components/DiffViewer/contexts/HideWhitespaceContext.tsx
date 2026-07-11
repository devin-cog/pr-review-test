import { createContext, useContextSelector } from "use-context-selector";

export const HideWhitespaceContext = createContext<{
  hideWhitespace: boolean;
  setHideWhitespace: (hide: boolean) => void;
}>({
  hideWhitespace: false,
  setHideWhitespace: () => {},
});

export function useHideWhitespace() {
  return useContextSelector(
    HideWhitespaceContext,
    (state) => state.hideWhitespace
  );
}

export function useSetHideWhitespace() {
  return useContextSelector(
    HideWhitespaceContext,
    (state) => state.setHideWhitespace
  );
}
