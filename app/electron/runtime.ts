export interface RuntimeStatus {
  rosAvailable: boolean;
  backendAvailable: boolean;
  liveAvailable: boolean;
  reason?: string;
}

interface RuntimeInspection {
  platform: NodeJS.Platform;
  rosAvailable: boolean;
  backendAvailable: boolean;
  rosSetupPath: string;
}

export function runtimeStatusFor({
  platform,
  rosAvailable,
  backendAvailable,
  rosSetupPath,
}: RuntimeInspection): RuntimeStatus {
  if (platform !== "linux") {
    return {
      rosAvailable: false,
      backendAvailable: false,
      liveAvailable: false,
      reason: `ROS 2 live mode is unavailable on ${platform}. File-only mode is active.`,
    };
  }

  const reason = !rosAvailable
    ? `ROS 2 was not found at ${rosSetupPath}. File-only mode is active.`
    : !backendAvailable
      ? "The bundled ros2-node-map backend is missing. File-only mode is active."
      : undefined;

  return {
    rosAvailable,
    backendAvailable,
    liveAvailable: rosAvailable && backendAvailable,
    reason,
  };
}
