import { Navigate, Route, Routes } from "react-router-dom";
import { CampaignProvider, useCampaign } from "./lib/campaign-context";
import { ToastProvider } from "./lib/toast";
import { ThemeProvider } from "./lib/theme";
import Shell from "./lib/Shell";
import Campaigns from "./pages/Campaigns";
import NewCampaign from "./pages/NewCampaign";
import CampaignHome from "./pages/CampaignHome";
import Scout from "./pages/Scout";
import Workday from "./pages/Workday";
import Ledger from "./pages/Ledger";

function Home() {
  const { active, campaigns, loaded } = useCampaign();
  if (!loaded) return <p className="p-6 text-brand-muted">Loading…</p>;
  if (campaigns.length === 0) return <Navigate to="/today" replace />;
  if (active) return <Navigate to="/today" replace />;
  return null;
}

function Page({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-5 sm:py-8 lg:px-6 lg:pb-8">{children}</main>;
}

export default function App() {
  return (
    <ThemeProvider>
      <CampaignProvider>
        <ToastProvider>
          <Shell>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/today" element={<Workday />} />
              <Route path="/campaigns" element={<Page><Campaigns /></Page>} />
              <Route path="/campaigns/new" element={<Page><NewCampaign /></Page>} />
              <Route path="/campaigns/:id" element={<Page><CampaignHome /></Page>} />
              <Route path="/scout" element={<Page><Scout /></Page>} />
              <Route path="/ledger" element={<Page><Ledger /></Page>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Shell>
        </ToastProvider>
      </CampaignProvider>
    </ThemeProvider>
  );
}
