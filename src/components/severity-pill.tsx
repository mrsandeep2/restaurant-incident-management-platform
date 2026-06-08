import { SEVERITY, STATUS, type Severity, type IncidentStatus } from "@/lib/incident-meta";
import { cn } from "@/lib/utils";

export function SeverityPill({ value }: { value: Severity }) {
  const s = SEVERITY[value];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1", s.bg, s.text, s.ring)}>
      <s.icon className="h-3 w-3" />
      {s.label}
    </span>
  );
}

export function StatusPill({ value }: { value: IncidentStatus }) {
  const s = STATUS[value];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs", s.bg, s.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", s.dot)} />
      {s.label}
    </span>
  );
}