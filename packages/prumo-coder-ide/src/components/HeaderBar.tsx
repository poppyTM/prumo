// packages/prumo-coder-ide/src/components/HeaderBar.tsx
import { MagnifyingGlass, Sparkle } from "phosphor-solid";

export interface HeaderBarProps {
  workspaceName: string;
  activeRunID?: string | null;
  isBusy: boolean;
  onOpenCommandPalette: () => void;
}

export function HeaderBar(props: HeaderBarProps) {
  return (
    <div style="height: var(--zed-header-height); background: var(--zed-bg-surface); border-bottom: 1px solid var(--zed-border-subtle); display: flex; align-items: center; justify-content: space-between; padding: 0 12px; font-size: 12px;">
      {/* Left: Brand & Workspace */}
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-weight: 600; color: var(--zed-text-accent); letter-spacing: 0.5px;">
          PRUMO
        </span>
        <span style="color: var(--zed-border-subtle);">/</span>
        <span style="color: var(--zed-text-primary); font-weight: 500;">
          {props.workspaceName}
        </span>
      </div>

      {/* Center: Command Palette Trigger */}
      <button
        onClick={props.onOpenCommandPalette}
        style="display: flex; align-items: center; gap: 6px; background: var(--zed-bg-app); border: 1px solid var(--zed-border-subtle); border-radius: 4px; padding: 3px 12px; color: var(--zed-text-muted); cursor: pointer; width: 280px; justify-content: space-between;"
      >
        <span style="display: flex; align-items: center; gap: 6px;">
          <MagnifyingGlass size={13} />
          <span>Quick Open...</span>
        </span>
        <kbd style="font-family: var(--zed-font-mono); font-size: 10px; background: var(--zed-bg-surface); padding: 1px 4px; border-radius: 3px; border: 1px solid var(--zed-border-subtle);">
          ⌘P
        </kbd>
      </button>

      {/* Right: Active Run Status */}
      <div style="display: flex; align-items: center; gap: 8px;">
        {props.isBusy ? (
          <span style="display: flex; align-items: center; gap: 4px; color: var(--zed-git-added); font-size: 11px;">
            <Sparkle size={13} weight="fill" />
            <span>Agent Working...</span>
          </span>
        ) : (
          <span style="color: var(--zed-text-muted); font-size: 11px;">
            Ready
          </span>
        )}
      </div>
    </div>
  );
}
