import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Campaign } from "../../../shared/types";
import { api } from "./api";
import { useLive } from "./live";

interface Ctx {
  campaigns: Campaign[];
  activeId: string | null;
  active: Campaign | null;
  setActiveId: (id: string) => void;
  refresh: () => Promise<void>;
  loaded: boolean;
}

const C = createContext<Ctx | null>(null);
const KEY = "tracker.activeCampaign";

export function CampaignProvider({ children }: { children: ReactNode }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeId, setActiveIdState] = useState<string | null>(() => localStorage.getItem(KEY));

  const refresh = async () => {
    const list = await api.campaigns();
    setCampaigns(list);
    setLoaded(true);
    if ((!activeId || !list.some((c) => c.id === activeId)) && list.length) {
      setActiveIdState(list[list.length - 1].id);
      localStorage.setItem(KEY, list[list.length - 1].id);
    }
  };

  useEffect(() => {
    refresh().catch(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLive(refresh);

  const setActiveId = (id: string) => {
    setActiveIdState(id);
    localStorage.setItem(KEY, id);
  };

  const value = useMemo<Ctx>(
    () => ({ campaigns, activeId, active: campaigns.find((c) => c.id === activeId) ?? null, setActiveId, refresh, loaded }),
    [campaigns, activeId, loaded],
  );
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useCampaign(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error("CampaignProvider missing");
  return v;
}
