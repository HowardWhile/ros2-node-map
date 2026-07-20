import { useEffect, useState } from "react";

interface DomainControlProps {
  displayedDomainId: string;
  backendUrl: string;
  sourceMode: "live" | "file";
  fileName: string;
  liveAvailable: boolean;
  onOpenFile: () => void;
  onResumeLive: () => void;
}

interface BackendDomainConfig {
  configurable: boolean;
  mode: "system" | "custom";
  system_domain_id: string;
  custom_domain_id: string;
  effective_domain_id: string;
}

function domainApiUrl(backendUrl: string): string {
  const url = new URL(backendUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  url.pathname = "/api/domain";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function normalizeBackendConfig(value: BackendDomainConfig): Ros2NodeMapDomainConfig {
  return {
    configurable: value.configurable,
    mode: value.mode,
    systemDomainId: value.system_domain_id,
    customDomainId: value.custom_domain_id,
    effectiveDomainId: value.effective_domain_id,
  };
}

async function requestBackendConfig(
  backendUrl: string,
  settings?: { mode: "system" | "custom"; customDomainId: string },
): Promise<Ros2NodeMapDomainConfig> {
  const response = await fetch(domainApiUrl(backendUrl), settings ? {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: settings.mode,
      custom_domain_id: settings.mode === "custom" ? Number(settings.customDomainId) : null,
    }),
  } : undefined);
  if (!response.ok) throw new Error(`Backend rejected domain settings (${response.status}).`);
  return normalizeBackendConfig(await response.json() as BackendDomainConfig);
}

export function DomainControl({
  displayedDomainId,
  backendUrl,
  sourceMode,
  fileName,
  liveAvailable,
  onOpenFile,
  onResumeLive,
}: DomainControlProps) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<Ros2NodeMapDomainConfig | null>(null);
  const [mode, setMode] = useState<"system" | "custom" | "file">("system");
  const [customDomainId, setCustomDomainId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setMessage("");
    if (sourceMode === "file") setMode("file");
    if (!liveAvailable) {
      setConfig(null);
      setMode("file");
      return;
    }
    const loadConfig = async () => {
      const electronConfig = await window.ros2NodeMap?.getDomainConfig();
      if (electronConfig?.configurable) return electronConfig;
      return requestBackendConfig(backendUrl);
    };
    void loadConfig().then((value) => {
      if (cancelled) return;
      setConfig(value);
      if (sourceMode === "live") setMode(value.mode);
      setCustomDomainId(value.customDomainId || value.effectiveDomainId);
    }).catch((error: unknown) => {
      if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to read domain settings.");
    });
    return () => { cancelled = true; };
  }, [backendUrl, liveAvailable, open, sourceMode]);

  const customIsValid = /^\d+$/.test(customDomainId) && Number(customDomainId) <= 232;
  const apply = async () => {
    if (mode === "file") {
      onOpenFile();
      setOpen(false);
      return;
    }
    if (!liveAvailable || !config?.configurable || (mode === "custom" && !customIsValid)) return;
    setSaving(true);
    setMessage("Restarting ROS discovery…");
    try {
      const electronConfig = await window.ros2NodeMap?.getDomainConfig();
      const value = electronConfig?.configurable
        ? await window.ros2NodeMap!.setDomainConfig({ mode, customDomainId })
        : await requestBackendConfig(backendUrl, { mode, customDomainId });
      setConfig(value);
      setMessage(`Switching to domain ${value.effectiveDomainId}…`);
      onResumeLive();
      window.setTimeout(() => setOpen(false), 500);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to change ROS domain.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="graph-domain-control">
      <button className="graph-domain-id" type="button" title="Configure ROS_DOMAIN_ID"
        aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span>ROS_DOMAIN_ID</span>
        <strong>{displayedDomainId}</strong>
        <em>{sourceMode === "file" ? "FILE" : "LIVE"}</em>
        <i aria-hidden="true">⌄</i>
      </button>
      {open && (
        <div className="domain-popover" role="dialog" aria-label="Configure ROS domain ID">
          <div className="domain-popover-heading">
            <strong>ROS domain</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close">×</button>
          </div>
          <label className="domain-option">
            <input type="radio" name="domain-mode" checked={mode === "system"}
              disabled={!liveAvailable}
              onChange={() => setMode("system")} />
            <span><strong>System</strong><small>ROS_DOMAIN_ID {config?.systemDomainId ?? displayedDomainId}</small></span>
          </label>
          <label className="domain-option">
            <input type="radio" name="domain-mode" checked={mode === "custom"}
              disabled={!liveAvailable}
              onChange={() => setMode("custom")} />
            <span><strong>Custom</strong><small>Use a different discovery domain</small></span>
          </label>
          <label className="domain-option">
            <input type="radio" name="domain-mode" checked={mode === "file"}
              onChange={() => setMode("file")} />
            <span><strong>File</strong><small>{fileName || "Open a graph JSON snapshot"}</small></span>
          </label>
          <input className="domain-input" type="number" min="0" max="232" inputMode="numeric"
            value={customDomainId} disabled={mode !== "custom" || !liveAvailable}
            aria-label="Custom ROS domain ID" onChange={(event) => setCustomDomainId(event.target.value)} />
          {mode === "custom" && customDomainId && !customIsValid && (
            <p className="domain-message is-error">Enter an integer from 0 to 232.</p>
          )}
          {message && <p className="domain-message">{message}</p>}
          {!liveAvailable && <p className="domain-message">ROS 2 is unavailable. Live domain options are disabled.</p>}
          <div className="domain-actions">
            <button type="button" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="is-primary" onClick={() => { void apply(); }}
              disabled={saving || (mode !== "file" && (!liveAvailable || !config?.configurable)) || (mode === "custom" && !customIsValid)}>
              {saving ? "Applying…" : mode === "file" ? "Open JSON…" : "Apply & reconnect"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
