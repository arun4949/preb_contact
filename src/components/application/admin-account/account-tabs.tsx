"use client";

import { useState, type ReactNode } from "react";
import { Tab, TabList, TabPanel, Tabs } from "@/components/base/tabs/tabs";

export interface AccountTabsProps {
  /** Tab to open first (from `?tab=`). */
  initial: string;
  /** The default tab, left out of the URL. */
  defaultTab: string;
  tabs: { id: string; label: string; count?: number; content: ReactNode }[];
}

/**
 * Tabs of the account page. Every panel is rendered on the server and handed
 * in, so switching is instant. The open tab is mirrored into `?tab=` with the
 * history API (no navigation, no refetch), which keeps it across a reload and
 * across the pagers that navigate with the current query string.
 */
export function AccountTabs({ initial, defaultTab, tabs }: AccountTabsProps) {
  const [selected, setSelected] = useState(initial);

  const select = (id: string) => {
    setSelected(id);
    const url = new URL(window.location.href);
    if (id === defaultTab) url.searchParams.delete("tab");
    else url.searchParams.set("tab", id);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  return (
    <Tabs selectedKey={selected} onSelectionChange={(key) => select(String(key))} className="gap-6">
      <div className="overflow-x-auto">
        <TabList aria-label="Account sections" className="min-w-max">
          {tabs.map((tab) => (
            <Tab key={tab.id} id={tab.id} count={tab.count}>
              {tab.label}
            </Tab>
          ))}
        </TabList>
      </div>
      {tabs.map((tab) => (
        <TabPanel key={tab.id} id={tab.id} className="flex flex-col gap-8">
          {tab.content}
        </TabPanel>
      ))}
    </Tabs>
  );
}
