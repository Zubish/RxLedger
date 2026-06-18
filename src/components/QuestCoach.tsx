import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { CheckCircle2, Trophy } from "lucide-react";

export type QuestCoachStep<TView extends string> = {
  id: string;
  title: string;
  body: string;
  view: TView;
  action: string;
};

export function QuestCoach<TView extends string>({
  steps,
  activeView,
  activeBranchId,
  branchCanSwitch,
  currentRoleLabel,
  setActiveView,
  indexKey,
  dismissedKey,
  positionKey,
  getStoredNumber,
  getStoredBoolean,
  setStoredValue,
}: {
  steps: QuestCoachStep<TView>[];
  activeView: TView;
  activeBranchId?: string;
  branchCanSwitch: boolean;
  currentRoleLabel: string;
  setActiveView: (view: TView) => void;
  indexKey: string;
  dismissedKey: string;
  positionKey: string;
  getStoredNumber: (key: string, fallback?: number) => number;
  getStoredBoolean: (key: string) => boolean;
  setStoredValue: (key: string, value: string) => void;
}) {
  const [index, setIndex] = useState(() => getStoredNumber(indexKey, 0));
  const [dismissed, setDismissed] = useState(() =>
    getStoredBoolean(dismissedKey),
  );
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    () => {
      if (typeof window === "undefined") return null;
      try {
        const stored = JSON.parse(
          window.localStorage.getItem(positionKey) || "null",
        ) as { x?: number; y?: number } | null;
        if (!stored || !Number.isFinite(stored.x) || !Number.isFinite(stored.y))
          return null;
        return { x: Number(stored.x), y: Number(stored.y) };
      } catch {
        return null;
      }
    },
  );
  const questRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });
  const [initialBranchId] = useState(activeBranchId);
  const completionTimerRef = useRef<number | undefined>(undefined);
  const lastCompletedStepRef = useRef("");
  const [completedTitle, setCompletedTitle] = useState("");
  const safeIndex = Math.min(index, Math.max(steps.length - 1, 0));
  const step = steps[safeIndex];
  const complete = step
    ? step.id === "branch-switcher"
      ? activeView === step.view &&
        (!branchCanSwitch || activeBranchId !== initialBranchId)
      : activeView === step.view
    : false;
  const progress = steps.length
    ? Math.round(((safeIndex + (complete ? 1 : 0)) / steps.length) * 100)
    : 100;
  const stepId = step?.id ?? "";
  const stepTitle = step?.title ?? "";

  useEffect(() => {
    setStoredValue(indexKey, String(safeIndex));
  }, [indexKey, safeIndex, setStoredValue]);

  useEffect(() => {
    setStoredValue(dismissedKey, String(dismissed));
  }, [dismissed, dismissedKey, setStoredValue]);

  useEffect(() => {
    if (!position || typeof window === "undefined") return;
    window.localStorage.setItem(positionKey, JSON.stringify(position));
  }, [position, positionKey]);

  useEffect(() => {
    if (!stepId || !complete || lastCompletedStepRef.current === stepId)
      return undefined;
    lastCompletedStepRef.current = stepId;
    setCompletedTitle(stepTitle);
    completionTimerRef.current = window.setTimeout(() => {
      setCompletedTitle("");
      if (safeIndex >= steps.length - 1) {
        setDismissed(true);
        return;
      }
      setIndex(safeIndex + 1);
    }, 2100);
    return () => window.clearTimeout(completionTimerRef.current);
  }, [complete, safeIndex, stepId, stepTitle, steps.length]);

  useEffect(() => {
    if (!position) return undefined;
    function handleResize() {
      setPosition((current) =>
        current ? clampQuestPosition(current.x, current.y) : current,
      );
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [position]);

  function clampQuestPosition(x: number, y: number) {
    if (typeof window === "undefined") return { x, y };
    const rect = questRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 360;
    const height = rect?.height ?? 260;
    const padding = 12;
    return {
      x: Math.min(
        Math.max(padding, x),
        Math.max(padding, window.innerWidth - width - padding),
      ),
      y: Math.min(
        Math.max(padding, y),
        Math.max(padding, window.innerHeight - height - padding),
      ),
    };
  }

  function beginDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!questRef.current) return;
    const rect = questRef.current.getBoundingClientRect();
    dragRef.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      originX: position?.x ?? rect.left,
      originY: position?.y ?? rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!dragRef.current.active) return;
    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragRef.current.moved = true;
    setPosition(
      clampQuestPosition(
        dragRef.current.originX + dx,
        dragRef.current.originY + dy,
      ),
    );
  }

  function endDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!dragRef.current.active) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
    dragRef.current.active = false;
  }

  if (dismissed || !step) return null;

  function next() {
    window.clearTimeout(completionTimerRef.current);
    setCompletedTitle("");
    lastCompletedStepRef.current = "";
    if (safeIndex >= steps.length - 1) {
      setDismissed(true);
      return;
    }
    setIndex(safeIndex + 1);
  }

  function previous() {
    window.clearTimeout(completionTimerRef.current);
    setCompletedTitle("");
    lastCompletedStepRef.current = "";
    setIndex(Math.max(0, safeIndex - 1));
  }

  return (
    <aside
      className={completedTitle ? "quest-coach is-complete" : "quest-coach"}
      ref={questRef}
      style={
        position
          ? { left: position.x, top: position.y, right: "auto", bottom: "auto" }
          : undefined
      }
      aria-label="Beta quest coach"
    >
      <div className="quest-coach-head">
        <button
          className="quest-drag-handle"
          type="button"
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          title="Drag quest card"
        >
          <Trophy size={16} />
          Beta quest
        </button>
        <button type="button" onClick={() => setDismissed(true)}>
          Skip
        </button>
      </div>
      <div className="quest-progress" aria-label={`${progress}% complete`}>
        <span style={{ width: `${progress}%` }} />
      </div>
      {completedTitle ? (
        <div className="quest-completion" role="status" aria-live="polite">
          <CheckCircle2 size={28} />
          <strong>Well done!</strong>
          <p>
            Congratulations, you just completed: {completedTitle}. Moving you to
            the next quest...
          </p>
        </div>
      ) : (
        <>
          <strong>{step.title}</strong>
          <p>{step.body}</p>
        </>
      )}
      <div className="quest-status">
        <span>
          {safeIndex + 1} of {steps.length}
        </span>
        <b className={complete ? "done" : ""}>
          {complete ? "Completed" : currentRoleLabel}
        </b>
      </div>
      <div className="quest-actions">
        <button
          className="ghost-button"
          type="button"
          onClick={() => setActiveView(step.view)}
          disabled={Boolean(completedTitle)}
        >
          {step.action}
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={previous}
          disabled={safeIndex === 0 || Boolean(completedTitle)}
        >
          Back
        </button>
        <button className="primary-button" type="button" onClick={next}>
          {safeIndex >= steps.length - 1 ? "Finish" : "Next"}
        </button>
      </div>
    </aside>
  );
}
