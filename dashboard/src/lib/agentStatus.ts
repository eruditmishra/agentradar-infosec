const AGENT_STATUS_STYLES: Record<string, string> = {
  approved: "bg-green/10 text-green border-green/20",
  shadow: "bg-orange-100 text-orange-600 border-orange-200",
  reviewed: "bg-brand/10 text-brand border-brand/20",
  flagged: "bg-red/10 text-red border-red/20",
  under_review: "bg-purple/10 text-purple border-purple/20",
};

const DEFAULT_STATUS_STYLE = "bg-amber/10 text-amber border-amber/20";

export function getAgentStatusStyle(status: string | null | undefined): string {
  if (!status) return DEFAULT_STATUS_STYLE;
  return AGENT_STATUS_STYLES[status] || DEFAULT_STATUS_STYLE;
}
