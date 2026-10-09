import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import "./mobile-disclosure.css";

/** Keeps desktop detail visible while letting small screens reveal it on demand. */
export function MobileDisclosure({ title, summary, children }: {
  title: string;
  summary?: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  return (
    <div className={`mobile-disclosure ${expanded ? "is-open" : ""}`}>
      <button className="mobile-disclosure-toggle" type="button" aria-expanded={expanded}
        aria-controls={contentId} onClick={() => setExpanded(!expanded)}>
        <span><strong>{title}</strong>{summary && <small>{summary}</small>}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      <div className="mobile-disclosure-content" id={contentId}>{children}</div>
    </div>
  );
}
