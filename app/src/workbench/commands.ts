import { CommandRegistry } from "@lumino/commands";
import type { PanelId, PanelRegistry } from "./PanelRegistry";
import type { WorkbenchShell } from "./WorkbenchShell";

export const COMMANDS = {
  openExplorer: "view.openExplorer", openGraph: "view.openGraph", openDetails: "view.openDetails",
  resetLayout: "view.resetLayout", saveLayout: "view.saveLayout",
} as const;

export function registerCommands(commands: CommandRegistry, shell: WorkbenchShell, panels: PanelRegistry): void {
  const open = (id: PanelId) => () => shell.openPanel(id);
  commands.addCommand(COMMANDS.openExplorer, { label: "Explorer", execute: open("ros2-node-map.explorer") });
  commands.addCommand(COMMANDS.openGraph, { label: "ROS Graph", execute: open("ros2-node-map.graph") });
  commands.addCommand(COMMANDS.openDetails, { label: "Details", execute: open("ros2-node-map.details") });
  commands.addCommand(COMMANDS.resetLayout, { label: "Reset Layout", execute: () => shell.resetLayout() });
  commands.addCommand(COMMANDS.saveLayout, { label: "Save Layout", execute: () => shell.saveLayout() });
  commands.addKeyBinding({ command: COMMANDS.openExplorer, keys: ["Accel Shift E"], selector: "body" });
  commands.addKeyBinding({ command: COMMANDS.openGraph, keys: ["Accel Shift G"], selector: "body" });
  commands.addKeyBinding({ command: COMMANDS.openDetails, keys: ["Accel Shift D"], selector: "body" });
  void panels;
}
