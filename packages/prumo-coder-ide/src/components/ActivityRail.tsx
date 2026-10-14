// packages/prumo-coder-ide/src/components/ActivityRail.tsx
import {
  FileText,
  GitDiff,
  Robot,
  TerminalWindow,
  Gear,
} from "phosphor-solid";

export type ActiveView = "explorer" | "changes" | "agent" | "terminal" | "settings";

export interface ActivityRailProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
}

export function ActivityRail(props: ActivityRailProps) {
  const items: { id: ActiveView; label: string; icon: typeof FileText }[] = [
    { id: "explorer", label: "Project Explorer", icon: FileText },
    { id: "changes", label: "Git Changes", icon: GitDiff },
    { id: "agent", label: "Prumo Agent", icon: Robot },
    { id: "terminal", label: "Terminal Dock", icon: TerminalWindow },
  ];

  return (
    <div style="width: var(--zed-rail-width); background: var(--zed-bg-surface); border-right: 1px solid var(--zed-border-subtle); display: flex; flex-direction: column; justify-content: space-between; align-items: center; padding: 6px 0;">
      {/* Top action icons */}
      <div style="display: flex; flex-direction: column; gap: 8px; width: 100%; align-items: center;">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = () => props.activeView === item.id;
          return (
            <button
              title={item.label}
              onClick={() => props.setActiveView(item.id)}
              style={`width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: ${isActive() ? "var(--zed-bg-active)" : "transparent"}; border: none; border-radius: 4px; color: ${isActive() ? "var(--zed-text-accent)" : "var(--zed-text-muted)"}; cursor: pointer; transition: background 0.15s;`}
            >
              <Icon size={18} weight={isActive() ? "bold" : "regular"} />
            </button>
          );
        })}
      </div>

      {/* Bottom settings icon */}
      <button
        title="Settings"
        onClick={() => props.setActiveView("settings")}
        style={`width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: ${props.activeView === "settings" ? "var(--zed-bg-active)" : "transparent"}; border: none; border-radius: 4px; color: ${props.activeView === "settings" ? "var(--zed-text-accent)" : "var(--zed-text-muted)"}; cursor: pointer;`}
      >
        <Gear size={18} weight="regular" />
      </button>
    </div>
  );
}
