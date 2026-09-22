// API Configuration and Cross-Environment Bridge for Galaxy S24 Ultra Vibration Monitor

export const CLOUD_APP_URL = "https://ais-pre-y6bfk464mae4hlrpsbi3jw-276271136787.asia-east1.run.app";

export function isLocalFileMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "file:";
}

export function getApiBaseUrl(): string {
  if (isLocalFileMode()) {
    return CLOUD_APP_URL;
  }
  return "";
}

export function getDefaultSensorUrl(): string {
  if (typeof window === "undefined") return `${CLOUD_APP_URL}?mode=sensor`;
  if (window.location.protocol === "file:") {
    return `${CLOUD_APP_URL}?mode=sensor`;
  }
  const currentUrl = window.location.href.split("?")[0];
  return `${currentUrl}?mode=sensor`;
}
