import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

const DOWNLOAD_PAGE_URL = 'https://nexa-chat-tau.vercel.app/download';
const GITHUB_API_RELEASES_URL = 'https://api.github.com/repos/Aakash-18-2006/Nexa-Chat-/releases/latest';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 Hours

/**
 * Returns true ONLY if running as a native Android app in Capacitor.
 * Ensures web users (desktop/mobile browsers) never run Android update checks.
 */
export const isAndroidNativeApp = () => {
  if (typeof window === 'undefined') return false;
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch (e) {
    return false;
  }
};

/**
 * Parses a semantic version string (e.g. 'v1.0.2' or '1.0.2') into [major, minor, patch].
 */
export const parseSemver = (verStr) => {
  if (!verStr || typeof verStr !== 'string') return [0, 0, 0];
  const cleaned = verStr.replace(/^v/i, '').trim();
  const parts = cleaned.split('.').map((p) => {
    const num = parseInt(p, 10);
    return isNaN(num) ? 0 : num;
  });
  while (parts.length < 3) parts.push(0);
  return parts.slice(0, 3);
};

/**
 * Returns true if remoteVersion is strictly newer than currentVersion.
 */
export const isNewerVersion = (remoteVersion, currentVersion) => {
  const [rMaj, rMin, rPat] = parseSemver(remoteVersion);
  const [cMaj, cMin, cPat] = parseSemver(currentVersion);

  if (rMaj > cMaj) return true;
  if (rMaj < cMaj) return false;
  if (rMin > cMin) return true;
  if (rMin < cMin) return false;
  return rPat > cPat;
};

/**
 * Gets the installed Android app version directly from the native runtime.
 */
export const getInstalledAppInfo = async () => {
  try {
    if (isAndroidNativeApp()) {
      const info = await App.getInfo();
      return {
        version: info.version || '1.0.0',
        build: parseInt(info.build, 10) || 1
      };
    }
  } catch (err) {
    console.debug('[UpdateService] Native App.getInfo() error:', err);
  }

  return {
    version: '1.0.0',
    build: 1
  };
};

/**
 * Authoritative release information fetched directly from GitHub Releases API.
 */
export const fetchLatestGitHubRelease = async () => {
  try {
    const ghResponse = await fetch(GITHUB_API_RELEASES_URL, {
      headers: { Accept: 'application/vnd.github.v3+json' },
      cache: 'no-store'
    });

    if (ghResponse.ok) {
      const ghData = await ghResponse.json();
      const tag = ghData.tag_name || ghData.name || '';
      const version = tag.replace(/^v/i, '').trim();

      if (version) {
        return {
          version,
          tagName: tag,
          downloadUrl: DOWNLOAD_PAGE_URL,
          apkUrl: 'https://github.com/Aakash-18-2006/Nexa-Chat-/releases/latest/download/NEXA-Android.apk',
          releaseNotes: ghData.body || 'A new update for NEXA is available.'
        };
      }
    }
  } catch (err) {
    console.debug('[UpdateService] GitHub releases check failed:', err);
  }

  return null;
};

/**
 * Checks for updates exclusively for native Android app users.
 * Never runs or shows prompts in desktop or mobile web browsers.
 * @param {boolean} force - If true, bypasses 24-hour rate limit
 */
export const checkForAppUpdate = async (force = false) => {
  // STRICT: Only native Android APK execution allowed
  if (!isAndroidNativeApp()) {
    return null;
  }

  const now = Date.now();
  const lastCheckStr = localStorage.getItem('nexa_last_update_check');
  const lastCheckTime = lastCheckStr ? parseInt(lastCheckStr, 10) : 0;

  // Rate-limit network requests to once every 24 hours
  if (!force && lastCheckTime && now - lastCheckTime < CHECK_INTERVAL_MS) {
    return null;
  }

  const installed = await getInstalledAppInfo();
  const latestRelease = await fetchLatestGitHubRelease();

  localStorage.setItem('nexa_last_update_check', String(now));

  if (!latestRelease || !latestRelease.version) {
    return null;
  }

  if (isNewerVersion(latestRelease.version, installed.version)) {
    const dismissedAtStr = localStorage.getItem('nexa_update_dismissed_at');
    const dismissedVersion = localStorage.getItem('nexa_update_dismissed_version');
    const dismissedTime = dismissedAtStr ? parseInt(dismissedAtStr, 10) : 0;

    // Check if user chose "Later" for this version in the last 24h
    if (!force && dismissedVersion === latestRelease.version && now - dismissedTime < CHECK_INTERVAL_MS) {
      return null;
    }

    return {
      hasUpdate: true,
      currentVersion: installed.version,
      latestVersion: latestRelease.version,
      downloadUrl: latestRelease.downloadUrl,
      apkUrl: latestRelease.apkUrl,
      releaseNotes: latestRelease.releaseNotes
    };
  }

  return null;
};

/**
 * Snoozes the update prompt for the specified version for 24 hours.
 */
export const dismissUpdatePrompt = (version) => {
  localStorage.setItem('nexa_update_dismissed_at', String(Date.now()));
  if (version) {
    localStorage.setItem('nexa_update_dismissed_version', String(version));
  }
};

/**
 * Opens the NEXA download page in the system browser so the user can download and install the APK.
 */
export const openDownloadPage = async (targetUrl = DOWNLOAD_PAGE_URL) => {
  try {
    if (isAndroidNativeApp()) {
      await Browser.open({ url: targetUrl, windowName: '_system' });
      return;
    }
  } catch (err) {
    console.debug('[UpdateService] Browser.open error, fallback to window.open:', err);
  }

  if (typeof window !== 'undefined') {
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }
};
