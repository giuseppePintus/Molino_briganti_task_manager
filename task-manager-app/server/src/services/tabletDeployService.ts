import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);
const APP_PACKAGE_NAME = 'com.molinobriganti.operatorlite';

type TabletEnvironment = 'shadow' | 'prod';
type TabletAction = 'install' | 'uninstall';

interface TabletRegistryItem {
  id: string;
  name?: string;
  shadowIp?: string;
  prodIp?: string;
  enabled?: boolean;
}

interface RuntimeStatus {
  reachable: boolean;
  configurable: boolean;
  installed: boolean;
  state: string;
  message?: string;
}

function getAdbExecutable(): string {
  return process.env.ADB_PATH || 'adb';
}

function isLikelyConnectedOutput(output: string): boolean {
  const normalized = (output || '').toLowerCase();
  return normalized.includes('connected to') || normalized.includes('already connected to');
}

async function runAdb(args: string[], timeoutMs: number = 15000): Promise<{ success: boolean; output: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(getAdbExecutable(), args, { timeout: timeoutMs });
    return {
      success: true,
      output: [stdout, stderr].filter(Boolean).join('\n').trim()
    };
  } catch (error: any) {
    const stdout = error?.stdout || '';
    const stderr = error?.stderr || '';
    const message = String(error?.message || 'adb execution failed');
    if (message.includes('ENOENT')) {
      return {
        success: false,
        output: 'ADB command non disponibile sul server. Installa Android Platform Tools nel container.'
      };
    }
    return {
      success: false,
      output: [stdout, stderr, message].filter(Boolean).join('\n').trim()
    };
  }
}

function isPackageInstalledOutput(output: string): boolean {
  const normalized = (output || '').toLowerCase();
  return normalized.includes('package:/') || normalized.includes(`package:${APP_PACKAGE_NAME.toLowerCase()}`);
}

async function isPackageInstalled(endpoint: string): Promise<boolean> {
  const byPath = await runAdb(['-s', endpoint, 'shell', 'pm', 'path', APP_PACKAGE_NAME], 30000);
  if (isPackageInstalledOutput(byPath.output)) {
    return true;
  }

  const byList = await runAdb(['-s', endpoint, 'shell', 'pm', 'list', 'packages', APP_PACKAGE_NAME], 30000);
  if (isPackageInstalledOutput(byList.output)) {
    return true;
  }

  return false;
}

export function resolveTabletEndpoint(tablet: TabletRegistryItem, environment: TabletEnvironment, adbPort: number = 5555): string | null {
  const ip = environment === 'prod' ? tablet.prodIp : tablet.shadowIp;
  if (!ip) return null;
  return `${ip}:${adbPort}`;
}

export async function getTabletRuntimeStatus(endpoint: string): Promise<RuntimeStatus> {
  const connectResult = await runAdb(['connect', endpoint]);
  if (!connectResult.success && !isLikelyConnectedOutput(connectResult.output)) {
    const isAdbMissing = /ADB command non disponibile/i.test(connectResult.output || '');
    return {
      reachable: false,
      configurable: false,
      installed: false,
      state: isAdbMissing ? 'adb-missing' : 'offline',
      message: connectResult.output || 'Connessione ADB non riuscita'
    };
  }

  const stateResult = await runAdb(['-s', endpoint, 'get-state']);
  const state = (stateResult.output || '').trim().toLowerCase();
  const isDevice = stateResult.success && state === 'device';

  if (!isDevice) {
    return {
      reachable: false,
      configurable: false,
      installed: false,
      state: state || 'unknown',
      message: stateResult.output || 'Dispositivo non pronto per il deploy'
    };
  }

  const installed = await isPackageInstalled(endpoint);

  return {
    reachable: true,
    configurable: true,
    installed,
    state: 'device'
  };
}

function resolveUploadsDir(): string {
  return process.env.UPLOAD_DIR || (
    process.env.NODE_ENV === 'production'
      ? '/app/uploads'
      : path.join(process.cwd(), 'uploads')
  );
}

function resolveApkUploadsDir(): string {
  return process.env.APK_UPLOAD_DIR || path.join(resolveUploadsDir(), 'apks');
}

function listApkCandidates(apkDir: string) {
  if (!fs.existsSync(apkDir)) {
    return [] as { name: string; fullPath: string; mtime: number }[];
  }

  return fs.readdirSync(apkDir)
    .filter((name) => /\.apk$/i.test(name))
    .map((name) => ({
      name,
      fullPath: path.join(apkDir, name),
      mtime: fs.statSync(path.join(apkDir, name)).mtimeMs
    }));
}

function resolveApkPath(apkFilename?: string): string {
  const apkUploadsDir = resolveApkUploadsDir();
  const legacyUploadsDir = resolveUploadsDir();

  if (!fs.existsSync(apkUploadsDir) && !fs.existsSync(legacyUploadsDir)) {
    throw new Error('Directory APK non trovata');
  }

  if (apkFilename) {
    const safeName = path.basename(apkFilename);
    if (!/\.apk$/i.test(safeName)) {
      throw new Error('Il file selezionato non è un APK valido');
    }

    const preferredPath = path.join(apkUploadsDir, safeName);
    const legacyPath = path.join(legacyUploadsDir, safeName);
    if (fs.existsSync(preferredPath)) {
      return preferredPath;
    }
    if (fs.existsSync(legacyPath)) {
      return legacyPath;
    }

    if (!fs.existsSync(preferredPath)) {
      throw new Error('APK selezionato non trovato sul server');
    }
  }

  const apks = listApkCandidates(apkUploadsDir)
    .concat(listApkCandidates(legacyUploadsDir))
    .sort((a, b) => b.mtime - a.mtime);

  if (apks.length === 0) {
    throw new Error('Nessun APK disponibile sul server');
  }

  return apks[0].fullPath;
}

export async function runTabletAction(endpoint: string, action: TabletAction, apkFilename?: string): Promise<{ output: string }> {
  const connectResult = await runAdb(['connect', endpoint]);
  if (!connectResult.success && !isLikelyConnectedOutput(connectResult.output)) {
    throw new Error(connectResult.output || 'Connessione ADB non riuscita');
  }

  const stateResult = await runAdb(['-s', endpoint, 'get-state']);
  const state = (stateResult.output || '').trim().toLowerCase();
  if (!(stateResult.success && state === 'device')) {
    throw new Error(stateResult.output || 'Dispositivo non pronto');
  }

  if (action === 'uninstall') {
    const uninstallResult = await runAdb(['-s', endpoint, 'uninstall', APP_PACKAGE_NAME]);
    if (!uninstallResult.success && !/success/i.test(uninstallResult.output || '')) {
      throw new Error(uninstallResult.output || 'Disinstallazione fallita');
    }
    return { output: uninstallResult.output || 'Success' };
  }

  const apkPath = resolveApkPath(apkFilename);
  const installResult = await runAdb(['-s', endpoint, 'install', '-r', apkPath]);
  if (!installResult.success && !/success/i.test(installResult.output || '')) {
    throw new Error(installResult.output || 'Installazione fallita');
  }

  return { output: installResult.output || 'Success' };
}
