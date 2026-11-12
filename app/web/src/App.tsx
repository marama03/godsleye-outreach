import { Navigate, Route, Routes } from "react-router-dom";
import { CampaignProvider, useCampaign } from "./lib/campaign-context";
import { ToastProvider } from "./lib/toast";
import { ThemeProvider } from "./lib/theme";
import Shell from "./lib/Shell";
import NewCampaign from "./pages/NewCampaign";
import CampaignHome from "./pages/CampaignHome";
import Scout from "./pages/Scout";
import Workday from "./pages/Workday";
import Ledger from "./pages/Ledger";

function Home() {
  const { active, campaigns } = useCampaign();
  if (campaigns.length === 0) return <Navigate to="/campaigns/new" replace />;
  if (active) return <Navigate to="/today" replace />;
  return null;
}

function Page({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-5xl px-5 py-8 lg:px-6">{children}</main>;
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
