import { Link } from "react-router-dom";
import { useCampaign } from "./campaign-context";

/** Shown instead of an endless "Loading…" when a screen cannot load its campaign. */
export default function LoadProblem({ message }: { message: string }) {
  const { active } = useCampaign();
  return (
    <div className="mx-auto max-w-[640px] px-6 py-12">
      <h1 className="font-display text-2xl font-black">This campaign cannot be shown</h1>
      <p className="mt-2 text-brand-ink">{message}</p>
      <p className="mt-3 text-sm text-brand-muted">Nothing was changed. Pick another campaign in the sidebar, or remove this one.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {active && <Link className="btn-secondary" to={`/campaigns/${active.id}`}>Manage campaign</Link>}
        <Link className="btn-primary" to="/campaigns/new">Create a campaign</Link>
      </div>
    </div>
  );
}
