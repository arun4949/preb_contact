"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { FeaturebaseProvider, useFeaturebase } from "featurebase-js/react";
import { FEATUREBASE_APP_ID } from "@/lib/featurebase/config";
import { useThemeMode } from "@/components/application/theme/theme-toggle";

/*
 * Messenger lifecycle. Identity must travel inside the SDK's *boot* call: the
 * separate `identify` action (what the Provider sends when `featurebaseJwt`
 * changes after boot) is refused on the Featurebase Free plan, and the
 * Provider never drops identity on its own either. So every identity change
 * is a full cycle: shutdown() (the SDK flushes it after a 250 ms grace), then
 * a fresh Provider mount, keyed by the token, which boots with that identity.
 *
 * Only `featurebase-js/react` may be imported here: the package root bundles a
 * second SDK copy with its own boot state, so its helpers never reach the
 * running messenger.
 *
 * The Provider is rendered beside the app, not around it, so remounting it
 * does not reset the page tree. useFeaturebase() works without its context
 * (only `unreadCount` would read 0).
 */

/** The SDK defers its own shutdown by 250 ms; boot again after that window. */
const REBOOT_DELAY_MS = 400;

const IdentityContext = createContext<(jwt: string | null) => void>(() => {});

/**
 * Root mount for the Featurebase messenger. Anonymous on public pages
 * (website, login, onboarding); the signed-in shell passes a server-minted
 * token through <FeaturebaseIdentity>. Follows the in-app light/dark toggle.
 */
export function FeaturebaseRoot({ children }: { children: ReactNode }) {
  const theme = useThemeMode();
  const { setTheme, shutdown } = useFeaturebase();
  // Identity requested by the tree (null = anonymous); `active` is what is booted.
  const [jwt, setJwt] = useState<string | null>(null);
  const [active, setActive] = useState<{ jwt: string | null } | null>(null);
  const booted = useRef(false);

  // The first commit already carries the shell's token (child effects run
  // before this one), so the first boot never has to be redone.
  useEffect(() => {
    if (!booted.current) {
      booted.current = true;
      setActive({ jwt });
      return;
    }
    setActive(null);
    shutdown();
    const timer = setTimeout(() => setActive({ jwt }), REBOOT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [jwt, shutdown]);

  // The boot theme only applies once; later toggles go to the running messenger.
  useEffect(() => {
    setTheme(theme);
  }, [theme, setTheme]);

  return (
    <>
      {active && (
        <FeaturebaseProvider key={active.jwt ?? "anonymous"} appId={FEATUREBASE_APP_ID} featurebaseJwt={active.jwt ?? undefined} theme={theme} language="en">
          {null}
        </FeaturebaseProvider>
      )}
      <IdentityContext.Provider value={setJwt}>{children}</IdentityContext.Provider>
    </>
  );
}

/**
 * Rendered by the signed-in layout with a server-minted token. Identifies the
 * visitor while mounted and drops the identity when the shell unmounts
 * (logout, deleted session).
 */
export function FeaturebaseIdentity({ jwt }: { jwt: string | null }) {
  const setJwt = useContext(IdentityContext);
  useEffect(() => {
    setJwt(jwt);
    return () => setJwt(null);
  }, [jwt, setJwt]);
  return null;
}

/** Messenger controls for app UI (account menu, empty states, errors). */
export function useSupportChat() {
  const { show, showNewMessage, showSpace, shutdown } = useFeaturebase();
  return { show, showNewMessage, showSpace, shutdown };
}
