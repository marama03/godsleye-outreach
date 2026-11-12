// R3 VARIANT BY HASH. Pure, isomorphic (no node imports) so server, scripts and web agree.
// variant = (parseInt(lead_id[0],16) % 2 === 0) ? "A" : "B"
// Never alternate by order, never by row number. Stable when leads are added.
export function variantFor(leadId: string): "A" | "B" {
  return parseInt(leadId[0], 16) % 2 === 0 ? "A" : "B";
}
