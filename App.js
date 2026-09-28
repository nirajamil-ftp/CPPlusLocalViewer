import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as SecureStore from 'expo-secure-store';

const DEFAULT_SETTINGS = {
  routerIp: '10.25.78.88',
  serverPort: '8080',
  onvifIp: '',
  onvifUsername: 'admin',
  onvifPassword: '',
};
const SETTINGS_STORAGE_KEY = 'cp-plus-viewer-settings';
const UPDATE_CONFIG_URL = 'https://raw.githubusercontent.com/nirajamil-ftp/CPPlusLocalViewer/main/app.json';
const UPDATE_APK_URL = 'https://raw.githubusercontent.com/nirajamil-ftp/CPPlusLocalViewer/main/CPPlusLocalViewer.apk';
const CURRENT_PACKAGE = 'com.nirajamil.CPPlusLocalViewer';
const COMMON_CAMERA_SERVER_PORTS = [80, 8080, 8000, 8081, 8088, 8888, 3000, 5000, 9000];
const PORT_PROBE_TIMEOUT_MS = 1500;
const NETWORK_MAP_PORTS = [80, 8080, 8000, 8081, 8888, 5000];
const NETWORK_SCAN_TIMEOUT_MS = 450;
const NETWORK_SCAN_BATCH_SIZE = 24;

const normalizeHost = (value) => value.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');

const isValidHost = (value) => (
  /^[a-zA-Z0-9.-]+(?::\d{1,5})?$/.test(normalizeHost(value))
);

const buildServerUrl = (host, port) => (
  `http://${normalizeHost(host)}:${String(port).trim() || '8080'}`
);

const buildOnvifUrl = (host) => {
  const value = host.trim().replace(/\/+$/, '');
  const baseUrl = /^https?:\/\//i.test(value) ? value : `http://${value}`;
  return baseUrl.endsWith('/onvif/device_service')
    ? baseUrl
    : `${baseUrl}/onvif/device_service`;
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = PORT_PROBE_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const probeHttpPort = async (host, port) => {
  const url = buildServerUrl(host, port);
  try {
    const response = await fetchWithTimeout(url, { method: 'HEAD' });
    return response.status < 500;
  } catch (_headError) {
    try {
      const response = await fetchWithTimeout(url, { method: 'GET' });
      return response.status < 500;
    } catch (_getError) {
      return false;
    }
  }
};

const getIpv4SubnetBase = (value) => {
  const host = normalizeHost(value);
  const parts = host.split('.');
  if (parts.length !== 4 || parts.some(part => !/^\d+$/.test(part) || Number(part) > 255)) {
    return null;
  }
  return parts.slice(0, 3).join('.');
};

const probeNetworkHost = async (host, ports) => {
  const startedAt = Date.now();
  const results = await Promise.all(
    ports.map(async (port) => {
      try {
        const response = await fetchWithTimeout(
          buildServerUrl(host, port),
          { method: 'HEAD' },
          NETWORK_SCAN_TIMEOUT_MS,
        );
        return response.status < 500 ? { port, status: response.status } : null;
      } catch (_error) {
        return null;
      }
    }),
  );
  const workingService = results.find(Boolean);
  return workingService
    ? {
      host,
      port: workingService.port,
      status: workingService.status,
      latency: Date.now() - startedAt,
    }
    : null;
};

const escapeXml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const formatTimestamp = (date) => {
  const time = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const day = date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).replace(/\//g, '.');
  return `${time} ${day}`;
};

export default function App() {
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [signalStrength, setSignalStrength] = useState('Checking...');
  const [diagnosticLogs, setDiagnosticLogs] = useState([]);
  const [webViewKey, setWebViewKey] = useState(0);
  const [webViewError, setWebViewError] = useState(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [draftSettings, setDraftSettings] = useState(DEFAULT_SETTINGS);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState('');
  const [onvifStatus, setOnvifStatus] = useState('');
  const [isDetectingPort, setIsDetectingPort] = useState(false);
  const [portDetectionStatus, setPortDetectionStatus] = useState('');
  const [showNetworkMap, setShowNetworkMap] = useState(false);
  const [networkNodes, setNetworkNodes] = useState([]);
  const [networkScanStatus, setNetworkScanStatus] = useState('');
  const [networkScanProgress, setNetworkScanProgress] = useState(0);
  const [isScanningNetwork, setIsScanningNetwork] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const autoPortDetectionAttempted = useRef(false);
  const portDetectionInFlight = useRef(false);
  const networkScanInFlight = useRef(false);

  const serverUrl = useMemo(
    () => buildServerUrl(settings.routerIp, settings.serverPort),
    [settings.routerIp, settings.serverPort],
  );
  const currentVersion = Constants.expoConfig?.version || '1.0.4';
  const currentVersionCode = Number(Constants.expoConfig?.android?.versionCode || 5);

  const addLog = (message) => {
    const time = new Date().toLocaleTimeString();
    setDiagnosticLogs(prev => [`[${time}] ${message}`, ...prev.slice(0, 15)]);
  };

  const detectServerPort = async (sourceSettings, { persist = false } = {}) => {
    const host = normalizeHost(sourceSettings.routerIp);
    if (!isValidHost(host)) {
      const message = 'Enter a valid camera server IP or hostname before scanning.';
      setPortDetectionStatus(message);
      if (persist) addLog(message);
      return null;
    }

    const currentPort = Number(sourceSettings.serverPort);
    const candidatePorts = [...new Set([
      Number.isInteger(currentPort) && currentPort > 0 && currentPort <= 65535 ? currentPort : null,
      ...COMMON_CAMERA_SERVER_PORTS,
    ].filter(Boolean))];

    if (portDetectionInFlight.current) return null;
    portDetectionInFlight.current = true;
    setIsDetectingPort(true);
    setPortDetectionStatus(`Scanning ${candidatePorts.length} common camera ports...`);

    try {
      const results = await Promise.all(
        candidatePorts.map(async (port) => ({
          port,
          reachable: await probeHttpPort(host, port),
        })),
      );
      const detected = results.find(result => result.reachable);

      if (!detected) {
        const message = `No working HTTP service found on ${host}.`;
        setPortDetectionStatus(message);
        if (persist) addLog(message);
        return null;
      }

      const detectedPort = String(detected.port);
      const message = `Found a working camera server on port ${detectedPort}.`;
      setPortDetectionStatus(
        persist ? message : `${message} Tap Save settings to apply it.`,
      );
      addLog(`${message} Host: ${host}`);

      if (persist && detectedPort !== String(sourceSettings.serverPort)) {
        const nextSettings = { ...sourceSettings, routerIp: host, serverPort: detectedPort };
        if (Platform.OS !== 'web') {
          await SecureStore.setItemAsync(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
        }
        setSettings(nextSettings);
        setDraftSettings(nextSettings);
        setWebViewError(null);
        setWebViewKey(currentKey => currentKey + 1);
      } else if (!persist) {
        setDraftSettings(current => ({ ...current, routerIp: host, serverPort: detectedPort }));
      }

      return detectedPort;
    } catch (error) {
      const message = `Port scan failed: ${error.message}`;
      setPortDetectionStatus(message);
      addLog(message);
      return null;
    } finally {
      portDetectionInFlight.current = false;
      setIsDetectingPort(false);
    }
  };

  const scanLocalNetwork = async () => {
    if (networkScanInFlight.current) return;

    const subnetBase = getIpv4SubnetBase(settings.routerIp);
    if (!subnetBase) {
      setNetworkScanStatus('Network map needs an IPv4 camera server address, such as 192.168.1.50.');
      setNetworkNodes([]);
      return;
    }

    networkScanInFlight.current = true;
    setIsScanningNetwork(true);
    setNetworkScanProgress(0);
    setNetworkScanStatus(`Scanning ${subnetBase}.1–254 for local HTTP devices...`);

    const configuredHost = normalizeHost(settings.routerIp);
    const ports = [...new Set([Number(settings.serverPort), ...NETWORK_MAP_PORTS])]
      .filter(port => Number.isInteger(port) && port > 0 && port <= 65535);
    const hosts = Array.from({ length: 254 }, (_, index) => `${subnetBase}.${index + 1}`);
    const foundNodes = [];

    try {
      for (let index = 0; index < hosts.length; index += NETWORK_SCAN_BATCH_SIZE) {
        const batch = hosts.slice(index, index + NETWORK_SCAN_BATCH_SIZE);
        const results = await Promise.all(batch.map(host => probeNetworkHost(host, ports)));
        results.filter(Boolean).forEach(result => foundNodes.push({
          ...result,
          role: result.host === configuredHost ? 'Camera server' : 'HTTP device',
        }));
        setNetworkScanProgress(Math.min(100, Math.round(((index + batch.length) / hosts.length) * 100)));
      }

      foundNodes.sort((left, right) => {
        if (left.host === configuredHost) return -1;
        if (right.host === configuredHost) return 1;
        return left.latency - right.latency;
      });
      setNetworkNodes(foundNodes);
      const deviceLabel = foundNodes.length === 1 ? 'device' : 'devices';
      setNetworkScanStatus(
        foundNodes.length
          ? `Found ${foundNodes.length} reachable ${deviceLabel} on ${subnetBase}.0/24.`
          : `No HTTP devices responded on ${subnetBase}.0/24.`,
      );
      addLog(`Network map scan found ${foundNodes.length} HTTP device(s) on ${subnetBase}.0/24.`);
    } catch (error) {
      setNetworkScanStatus(`Network scan failed: ${error.message}`);
      addLog(`Network map error: ${error.message}`);
    } finally {
      networkScanInFlight.current = false;
      setIsScanningNetwork(false);
    }
  };

  const openNetworkMap = () => {
    setShowHelp(false);
    setShowNetworkMap(true);
    if (!networkNodes.length) scanLocalNetwork();
  };

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      let savedSettings = DEFAULT_SETTINGS;
      if (Platform.OS !== 'web') {
        try {
          const savedValue = await SecureStore.getItemAsync(SETTINGS_STORAGE_KEY);
          if (savedValue) {
            savedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedValue) };
          }
        } catch (error) {
          addLog(`Could not load saved settings: ${error.message}`);
        }
      }
      if (isMounted) {
        setSettings(savedSettings);
        setDraftSettings(savedSettings);
        setSettingsLoaded(true);
      }
    };

    loadSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return undefined;

    const checkConnection = async () => {
      addLog('Pinging server...');
      try {
        const start = Date.now();
        const response = await fetch(serverUrl, { method: 'HEAD' });
        const latency = Date.now() - start;
        if (response.status < 500) {
          setIsConnected(true);
          addLog(`Success! Latency: ${latency}ms`);
          if (latency < 100) setSignalStrength(`Excellent (${latency}ms)`);
          else if (latency < 300) setSignalStrength(`Good (${latency}ms)`);
          else setSignalStrength(`Weak (${latency}ms)`);
        } else {
          setIsConnected(false);
          addLog(`Server responded with status: ${response.status}`);
          setSignalStrength('Disconnected');
          if (!autoPortDetectionAttempted.current) {
            autoPortDetectionAttempted.current = true;
            await detectServerPort(settings, { persist: true });
          }
        }
      } catch (error) {
        setIsConnected(false);
        addLog(`Connection Error: ${error.message}`);
        setSignalStrength('No Connection');
        if (!autoPortDetectionAttempted.current) {
          autoPortDetectionAttempted.current = true;
          await detectServerPort(settings, { persist: true });
        }
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, [serverUrl, settingsLoaded]);

  const handlePTZ = (action) => {
    console.log(`PTZ Action: ${action}`);
  };

  const openSettings = () => {
    setDraftSettings(settings);
    setUpdateStatus('');
    setOnvifStatus('');
    setPortDetectionStatus('');
    setShowSettings(true);
  };

  const updateDraftSetting = (key, value) => {
    setDraftSettings(current => ({ ...current, [key]: value }));
  };

  const saveSettings = async () => {
    const routerIp = normalizeHost(draftSettings.routerIp);
    const onvifIp = draftSettings.onvifIp.trim();
    const serverPort = String(draftSettings.serverPort).trim();
    const portNumber = Number(serverPort);

    if (!isValidHost(routerIp)) {
      Alert.alert('Invalid camera server IP', 'Enter an IPv4 address or local hostname.');
      return;
    }
    if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
      Alert.alert('Invalid server port', 'Enter a port between 1 and 65535.');
      return;
    }
    if (onvifIp && !isValidHost(onvifIp)) {
      Alert.alert('Invalid ONVIF IP', 'Enter an IPv4 address, hostname, or host with a port.');
      return;
    }

    const nextSettings = {
      routerIp,
      serverPort,
      onvifIp,
      onvifUsername: draftSettings.onvifUsername.trim() || 'admin',
      onvifPassword: draftSettings.onvifPassword,
    };

    setIsSavingSettings(true);
    try {
      if (Platform.OS !== 'web') {
        await SecureStore.setItemAsync(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
      }
      setSettings(nextSettings);
      setDraftSettings(nextSettings);
      autoPortDetectionAttempted.current = false;
      setWebViewError(null);
      setWebViewKey(currentKey => currentKey + 1);
      setShowSettings(false);
      addLog(`Saved camera server: ${buildServerUrl(nextSettings.routerIp, nextSettings.serverPort)}`);
      Alert.alert('Settings saved', 'The camera page is reconnecting with the new server address.');
    } catch (error) {
      Alert.alert('Could not save settings', error.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const testOnvifConnection = async () => {
    if (!draftSettings.onvifIp.trim()) {
      Alert.alert('ONVIF IP required', 'Enter the camera ONVIF IP or host before testing.');
      return;
    }
    if (!isValidHost(draftSettings.onvifIp)) {
      Alert.alert('Invalid ONVIF IP', 'Enter an IPv4 address, hostname, or host with a port.');
      return;
    }

    setOnvifStatus('Testing ONVIF device...');
    const requestBody = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:tds="http://www.onvif.org/ver10/device/wsdl" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <s:Header>
    <wsse:Security s:mustUnderstand="true">
      <wsse:UsernameToken>
        <wsse:Username>${escapeXml(draftSettings.onvifUsername || 'admin')}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${escapeXml(draftSettings.onvifPassword)}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </s:Header>
  <s:Body><tds:GetDeviceInformation /></s:Body>
</s:Envelope>`;

    try {
      const response = await Promise.race([
        fetch(buildOnvifUrl(draftSettings.onvifIp), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/soap+xml; charset=utf-8',
            SOAPAction: 'http://www.onvif.org/ver10/device/wsdl/GetDeviceInformation',
          },
          body: requestBody,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), 8000)),
      ]);

      if (!response.ok && response.status !== 401 && response.status !== 400) {
        throw new Error(`ONVIF server returned HTTP ${response.status}`);
      }
      if (response.status === 401) {
        setOnvifStatus('Device found, but the ONVIF username or password was rejected.');
        addLog('ONVIF device found but credentials were rejected.');
      } else {
        setOnvifStatus('ONVIF device responded successfully.');
        addLog('ONVIF device responded successfully.');
      }
    } catch (error) {
      setOnvifStatus(`ONVIF test failed: ${error.message}`);
      addLog(`ONVIF error: ${error.message}`);
    }
  };

  const openInstallPermissionSettings = async () => {
    if (Platform.OS !== 'android') return;
    try {
      await IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES', {
        data: `package:${CURRENT_PACKAGE}`,
      });
    } catch (error) {
      addLog(`Could not open install permission settings: ${error.message}`);
    }
  };

  const syncAppUpdate = async () => {
    setIsCheckingUpdate(true);
    setUpdateStatus('Checking GitHub for an update...');
    try {
      const response = await fetch(`${UPDATE_CONFIG_URL}?t=${Date.now()}`);
      if (!response.ok) throw new Error(`Update check returned HTTP ${response.status}`);
      const remoteConfig = await response.json();
      const remoteVersion = remoteConfig?.version || 'unknown';
      const remoteVersionCode = Number(remoteConfig?.android?.versionCode || 0);

      if (remoteVersionCode <= currentVersionCode) {
        setUpdateStatus(`You are up to date (v${currentVersion}).`);
        return;
      }

      if (Platform.OS !== 'android') {
        await Linking.openURL(UPDATE_APK_URL);
        setUpdateStatus(`Update v${remoteVersion} opened in your browser.`);
        return;
      }

      if (!FileSystem.documentDirectory) {
        throw new Error('App storage is unavailable.');
      }
      setUpdateStatus(`Downloading version ${remoteVersion}...`);
      const download = await FileSystem.downloadAsync(
        UPDATE_APK_URL,
        `${FileSystem.documentDirectory}CPPlusLocalViewer-update.apk`,
      );
      const contentUri = await FileSystem.getContentUriAsync(download.uri);

      try {
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          type: 'application/vnd.android.package-archive',
          flags: 1,
        });
        setUpdateStatus(`Version ${remoteVersion} is ready to install.`);
      } catch (installError) {
        setUpdateStatus('Android blocked APK installation. Allow installs from this app, then try again.');
        Alert.alert(
          'Allow app updates',
          'Android needs permission to install updates downloaded by this app.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open permission settings', onPress: openInstallPermissionSettings },
          ],
        );
        addLog(`APK installer blocked: ${installError.message}`);
      }
    } catch (error) {
      setUpdateStatus(`Update failed: ${error.message}`);
      addLog(`Update error: ${error.message}`);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const retryWebView = () => {
    setWebViewError(null);
    setWebViewKey((currentKey) => currentKey + 1);
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerIcon} onPress={() => setShowHelp(true)}>
            <Feather name="chevron-left" size={25} color="#e3eef2" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Living room</Text>
          <TouchableOpacity style={styles.headerIcon} onPress={openSettings}>
            <Feather name="settings" size={21} color="#d8e8ed" />
          </TouchableOpacity>
        </View>

        <View style={styles.previewCard}>
      <WebView
        key={webViewKey}
        source={{ uri: serverUrl }}
        style={styles.previewWebView}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        onLoadStart={() => setWebViewError(null)}
        onLoadEnd={() => setWebViewError(null)}
        onError={({ nativeEvent }) => {
          const detail = nativeEvent?.description || nativeEvent?.domain || 'Unknown WebView error';
          setWebViewError(detail);
          addLog(`Camera page error: ${detail}`);
        }}
        onHttpError={({ nativeEvent }) => {
          addLog(`Camera server HTTP error: ${nativeEvent.statusCode}`);
        }}
        renderError={() => (
           <View style={styles.errorState} />
        )}
      />
          <View style={styles.playbackPill}>
            <TouchableOpacity style={styles.playbackButton} onPress={() => addLog('Previous clip selected')}>
              <Text style={styles.playbackText}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.playbackButton} onPress={() => addLog('Playback toggled')}>
              <Text style={styles.playbackText}>Ⅱ</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.playbackButton} onPress={() => addLog('Next clip selected')}>
              <Text style={styles.playbackText}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.timestamp}>{formatTimestamp(currentTime)}</Text>

        <View style={styles.joystickFrame}>
          <TouchableOpacity
            style={[styles.sideButton, styles.sideButtonLeft]}
            accessibilityLabel="Pan camera left"
            testID="pan-left-button"
            onPress={() => handlePTZ('Pan Left')}
          >
            <Text style={[styles.joystickButtonText, styles.sideButtonText]}>◀</Text>
          </TouchableOpacity>
          <View style={styles.joystick}>
            <TouchableOpacity
              style={[styles.joystickButton, styles.joystickUp]}
              onPress={() => handlePTZ('Pan Up')}
            >
              <Text style={styles.joystickButtonText}>▲</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.joystickButton, styles.joystickRight]}
              onPress={() => handlePTZ('Pan Right')}
            >
              <Text style={styles.joystickButtonText}>▶</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.joystickButton, styles.joystickDown]}
              onPress={() => handlePTZ('Pan Down')}
            >
              <Text style={styles.joystickButtonText}>▼</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.joystickButton, styles.joystickLeft]}
              onPress={() => handlePTZ('Pan Left')}
            >
              <Text style={styles.joystickButtonText}>◀</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.joystickCenter} onPress={() => handlePTZ('Stop')}>
              <Text style={styles.joystickCenterText}>＝</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.sideButton, styles.sideButtonRight]}
            accessibilityLabel="Pan camera right"
            testID="pan-right-button"
            onPress={() => handlePTZ('Pan Right')}
          >
            <Text style={[styles.joystickButtonText, styles.sideButtonText]}>▶</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomActions}>
          <View style={styles.actionItem}>
            <TouchableOpacity
              testID="mute-button"
              accessibilityLabel="Mute camera audio"
              style={styles.bottomAction}
              onPress={() => addLog('Audio mute toggled')}
            >
              <Feather name="volume-x" size={21} color="#b3c6cc" />
            </TouchableOpacity>
            <Text style={styles.bottomActionLabel}>Mute</Text>
          </View>
          <View style={styles.actionItem}>
            <TouchableOpacity
              testID="power-button"
              accessibilityLabel="Camera power"
              style={styles.powerAction}
              onPress={() => addLog('Camera power action selected')}
            >
              <Feather name="power" size={24} color="#c7dadd" />
            </TouchableOpacity>
            <Text style={styles.bottomActionLabel}>Power</Text>
          </View>
          <View style={styles.actionItem}>
            <TouchableOpacity
              testID="snapshot-button"
              accessibilityLabel="Take camera snapshot"
              style={styles.bottomAction}
              onPress={() => addLog('Snapshot action selected')}
            >
              <Feather name="camera" size={21} color="#b3c6cc" />
            </TouchableOpacity>
            <Text style={styles.bottomActionLabel}>Snapshot</Text>
          </View>
        </View>

      <Modal
        visible={showHelp}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHelp(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Connection Diagnostics & Guide</Text>
            
            <View style={styles.statusBox}>
              <Text style={styles.statusLabel}>Connection Status:</Text>
              <Text style={[styles.statusValue, { color: isConnected ? '#28a745' : '#dc3545' }]}>
                {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
              </Text>
            </View>

            <View style={styles.statusBox}>
              <Text style={styles.statusLabel}>Signal / Latency:</Text>
              <Text style={styles.statusValue}>{signalStrength}</Text>
            </View>

            <Text style={styles.guideTitle}>Live Diagnostic Logs:</Text>
            <ScrollView style={styles.logsContainer}>
              {diagnosticLogs.map((log, index) => (
                <Text key={index} style={styles.logText}>{log}</Text>
              ))}
            </ScrollView>

            <TouchableOpacity
              testID="network-map-button"
              accessibilityLabel="Scan local network and open network map"
              style={styles.networkMapButton}
              onPress={openNetworkMap}
            >
              <Feather name="share-2" size={18} color="#08222e" />
              <Text style={styles.networkMapButtonText}>Open local network map</Text>
            </TouchableOpacity>

            <Text style={styles.guideTitle}>Wi-Fi Setup Guide:</Text>
            <Text style={styles.guideText}>1. Connect phone and PC to the same local Wi-Fi.</Text>
            <Text style={styles.guideText}>2. Verify server URL: {serverUrl}</Text>

            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => setShowHelp(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showNetworkMap}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNetworkMap(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.networkMapContainer}>
            <View style={styles.networkMapHeader}>
              <View>
                <Text style={styles.modalTitle}>Local network map</Text>
                <Text style={styles.networkMapCaption}>
                  Reachable HTTP devices on the camera server&apos;s local Wi-Fi range
                </Text>
              </View>
              <TouchableOpacity
                accessibilityLabel="Close network map"
                style={styles.networkMapClose}
                onPress={() => setShowNetworkMap(false)}
              >
                <Feather name="x" size={22} color="#d6e5ea" />
              </TouchableOpacity>
            </View>

            <View style={styles.networkMapCanvas}>
              <View style={styles.mapRootNode}>
                <Feather name="wifi" size={19} color="#08222e" />
                <Text style={styles.mapRootTitle}>This Wi-Fi</Text>
                <Text style={styles.mapRootSubtitle}>{getIpv4SubnetBase(settings.routerIp)}.0/24</Text>
              </View>
              <View style={styles.mapConnector} />
              <ScrollView
                style={styles.networkNodeList}
                contentContainerStyle={styles.networkNodeListContent}
                showsVerticalScrollIndicator={false}
              >
                {networkNodes.length ? networkNodes.map((node) => (
                  <View
                    key={`${node.host}:${node.port}`}
                    style={[
                      styles.networkNode,
                      node.host === normalizeHost(settings.routerIp) && styles.networkCameraNode,
                    ]}
                  >
                    <View style={styles.networkNodeIcon}>
                      <Feather
                        name={node.host === normalizeHost(settings.routerIp) ? 'video' : 'monitor'}
                        size={17}
                        color="#b8ffff"
                      />
                    </View>
                    <View style={styles.networkNodeDetails}>
                      <Text style={styles.networkNodeRole}>{node.role}</Text>
                      <Text style={styles.networkNodeHost}>{node.host}:{node.port}</Text>
                    </View>
                    <View style={styles.networkNodeHealth}>
                      <View style={styles.onlineDot} />
                      <Text style={styles.networkNodeLatency}>{node.latency}ms</Text>
                    </View>
                  </View>
                )) : (
                  <View style={styles.networkEmptyState}>
                    <Feather name="radio" size={28} color="#58e3e4" />
                    <Text style={styles.networkEmptyTitle}>
                      {isScanningNetwork ? 'Mapping your local network...' : 'No devices mapped yet'}
                    </Text>
                    {!isScanningNetwork && (
                      <Text style={styles.networkEmptyText}>
                        Start a scan to find reachable camera and web devices.
                      </Text>
                    )}
                  </View>
                )}
              </ScrollView>
            </View>

            <Text style={styles.networkScanStatus}>{networkScanStatus}</Text>
            {isScanningNetwork && (
              <View style={styles.scanProgressTrack}>
                <View style={[styles.scanProgressBar, { width: `${networkScanProgress}%` }]} />
              </View>
            )}
            <View style={styles.networkMapActions}>
              <TouchableOpacity
                testID="scan-network-button"
                style={[styles.scanNetworkButton, isScanningNetwork && styles.disabledButton]}
                onPress={scanLocalNetwork}
                disabled={isScanningNetwork}
              >
                {isScanningNetwork
                  ? <ActivityIndicator color="#08222e" />
                  : <><Feather name="refresh-cw" size={16} color="#08222e" /><Text style={styles.scanNetworkButtonText}>Scan again</Text></>}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeMapButton}
                onPress={() => setShowNetworkMap(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.networkMapHint}>
              The map checks common local HTTP camera/server ports. Devices that block HTTP probing may not appear.
            </Text>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSettings}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.settingsContainer}>
            <ScrollView
              contentContainerStyle={styles.settingsScroll}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.modalTitle}>Settings</Text>
              <Text style={styles.sectionCaption}>
                Update the local camera server and ONVIF connection details.
              </Text>

              <Text style={styles.inputLabel}>Camera server / router IP</Text>
              <TextInput
                value={draftSettings.routerIp}
                onChangeText={(value) => updateDraftSetting('routerIp', value)}
                placeholder="Example: 192.168.1.50"
                placeholderTextColor="#777"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={styles.input}
              />

              <Text style={styles.inputLabel}>Camera server port</Text>
              <TextInput
                value={draftSettings.serverPort}
                onChangeText={(value) => updateDraftSetting('serverPort', value.replace(/[^0-9]/g, ''))}
                placeholder="8080"
                placeholderTextColor="#777"
                keyboardType="number-pad"
                style={styles.input}
              />
              <TouchableOpacity
                style={[styles.secondaryButton, isDetectingPort && styles.disabledButton]}
                onPress={() => detectServerPort(draftSettings)}
                disabled={isDetectingPort}
              >
                {isDetectingPort
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.secondaryButtonText}>Detect working port</Text>}
              </TouchableOpacity>
              {!!portDetectionStatus && <Text style={styles.statusMessage}>{portDetectionStatus}</Text>}

              <Text style={styles.sectionTitle}>ONVIF camera</Text>
              <Text style={styles.inputLabel}>ONVIF IP / host</Text>
              <TextInput
                value={draftSettings.onvifIp}
                onChangeText={(value) => updateDraftSetting('onvifIp', value)}
                placeholder="Example: 192.168.1.60:80"
                placeholderTextColor="#777"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={styles.input}
              />

              <Text style={styles.inputLabel}>ONVIF username</Text>
              <TextInput
                value={draftSettings.onvifUsername}
                onChangeText={(value) => updateDraftSetting('onvifUsername', value)}
                placeholder="admin"
                placeholderTextColor="#777"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />

              <Text style={styles.inputLabel}>ONVIF password</Text>
              <TextInput
                value={draftSettings.onvifPassword}
                onChangeText={(value) => updateDraftSetting('onvifPassword', value)}
                placeholder="Stored securely on this device"
                placeholderTextColor="#777"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={true}
                style={styles.input}
              />

              <TouchableOpacity style={styles.secondaryButton} onPress={testOnvifConnection}>
                <Text style={styles.secondaryButtonText}>Test ONVIF connection</Text>
              </TouchableOpacity>
              {!!onvifStatus && <Text style={styles.statusMessage}>{onvifStatus}</Text>}

              <View style={styles.settingsActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowSettings(false)}
                  disabled={isSavingSettings}
                >
                  <Text style={styles.closeButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, isSavingSettings && styles.disabledButton]}
                  onPress={saveSettings}
                  disabled={isSavingSettings}
                >
                  {isSavingSettings
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.buttonText}>Save settings</Text>}
                </TouchableOpacity>
              </View>

              <View style={styles.updateCard}>
                <Text style={styles.sectionTitle}>Application update</Text>
                <Text style={styles.guideText}>Installed version: {currentVersion}</Text>
                <TouchableOpacity
                  style={[styles.updateButton, isCheckingUpdate && styles.disabledButton]}
                  onPress={syncAppUpdate}
                  disabled={isCheckingUpdate}
                >
                  {isCheckingUpdate
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.buttonText}>Sync App Update</Text>}
                </TouchableOpacity>
                {!!updateStatus && <Text style={styles.statusMessage}>{updateStatus}</Text>}
                <Text style={styles.updateHint}>
                  Updates are downloaded from the project GitHub repository and opened in Android's installer.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#09131e' },
  container: { flex: 1, backgroundColor: '#0b1520', paddingHorizontal: 18 },
  header: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerIcon: { alignItems: 'center', justifyContent: 'center', width: 42, height: 42 },
  headerIconText: { color: '#e3eef2', fontSize: 38, fontWeight: '200', lineHeight: 40 },
  headerTitle: { color: '#e4edf0', fontSize: 16, fontWeight: '600', letterSpacing: 0.2 },
  previewCard: { height: 222, backgroundColor: '#0b1520', borderRadius: 16, borderWidth: 1, borderColor: '#314b56', overflow: 'hidden' },
  previewWebView: { flex: 1, backgroundColor: '#0b1520' },
  playbackPill: { alignSelf: 'center', backgroundColor: 'rgba(8, 24, 37, 0.93)', borderRadius: 18, bottom: 14, flexDirection: 'row', paddingHorizontal: 7, paddingVertical: 3, position: 'absolute' },
  playbackButton: { alignItems: 'center', height: 32, justifyContent: 'center', width: 38 },
  playbackText: { color: '#fff', fontSize: 21, fontWeight: '700' },
  timestamp: { color: '#91a5ad', fontSize: 11, marginTop: 10, textAlign: 'center' },
  joystickFrame: { alignItems: 'center', alignSelf: 'center', flex: 1, justifyContent: 'flex-end', marginTop: 4, maxWidth: 300, minHeight: 230, paddingBottom: 6, position: 'relative', width: '100%' },
  joystick: { alignItems: 'center', backgroundColor: '#58e3e4', borderRadius: 100, elevation: 10, height: 196, justifyContent: 'center', shadowColor: '#40d9e0', shadowOpacity: 0.35, shadowRadius: 18, width: 196 },
  joystickButton: { alignItems: 'center', height: 52, justifyContent: 'center', position: 'absolute', width: 52 },
  joystickUp: { left: 72, top: 12 },
  joystickRight: { right: 12, top: 72 },
  joystickDown: { bottom: 12, left: 72 },
  joystickLeft: { left: 12, top: 72 },
  joystickButtonText: { color: '#f4ffff', fontSize: 16, fontWeight: '800', textShadowColor: 'rgba(23, 113, 126, 0.45)', textShadowOffset: { height: 1, width: 1 }, textShadowRadius: 3 },
  joystickCenter: { alignItems: 'center', backgroundColor: '#2e5366', borderRadius: 42, height: 84, justifyContent: 'center', width: 84 },
  joystickCenterText: { color: '#73909b', fontSize: 24, fontWeight: '600' },
  sideButton: { alignItems: 'center', backgroundColor: '#58e3e4', borderRadius: 25, height: 128, justifyContent: 'center', position: 'absolute', top: 62, width: 46, zIndex: 2 },
  sideButtonLeft: { left: 0 },
  sideButtonRight: { right: 0 },
  sideButtonText: { fontSize: 19 },
  bottomActions: { alignItems: 'flex-start', flexDirection: 'row', gap: 20, justifyContent: 'center', paddingBottom: 12, paddingTop: 4 },
  actionItem: { alignItems: 'center', minWidth: 64 },
  bottomAction: { alignItems: 'center', backgroundColor: '#172936', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  powerAction: { alignItems: 'center', backgroundColor: '#1a3440', borderRadius: 28, height: 56, justifyContent: 'center', width: 56 },
  bottomActionLabel: { color: '#91a5ad', fontSize: 10, fontWeight: '600', marginTop: 6 },
  errorState: { flex: 1, backgroundColor: '#0b1520' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '90%', maxHeight: '85%', backgroundColor: '#222', borderRadius: 10, padding: 15, borderWidth: 1, borderColor: '#444' },
  settingsContainer: { width: '94%', maxHeight: '92%', backgroundColor: '#222', borderRadius: 12, borderWidth: 1, borderColor: '#444' },
  settingsScroll: { padding: 18, paddingBottom: 28 },
  sectionCaption: { color: '#aaa', fontSize: 13, lineHeight: 19, marginBottom: 14 },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginTop: 12, marginBottom: 8 },
  inputLabel: { color: '#ccc', fontSize: 13, marginTop: 9, marginBottom: 5 },
  input: { backgroundColor: '#111', borderWidth: 1, borderColor: '#555', color: '#fff', borderRadius: 7, paddingHorizontal: 11, paddingVertical: 10, fontSize: 14 },
  secondaryButton: { alignItems: 'center', backgroundColor: '#444', borderRadius: 7, marginTop: 14, padding: 11 },
  secondaryButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  statusMessage: { color: '#9bd5ff', fontSize: 12, lineHeight: 18, marginTop: 8 },
  updateCard: { backgroundColor: '#2d2d2d', borderRadius: 8, marginTop: 18, padding: 12 },
  updateButton: { alignItems: 'center', backgroundColor: '#007bff', borderRadius: 7, marginTop: 8, minHeight: 42, justifyContent: 'center', paddingHorizontal: 15 },
  updateHint: { color: '#999', fontSize: 11, lineHeight: 16, marginTop: 8 },
  settingsActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelButton: { backgroundColor: '#555', borderRadius: 7, flex: 1, alignItems: 'center', padding: 11 },
  saveButton: { backgroundColor: '#198754', borderRadius: 7, flex: 1, alignItems: 'center', minHeight: 42, justifyContent: 'center', padding: 11 },
  disabledButton: { opacity: 0.6 },
  modalTitle: { fontSize: 18, color: '#fff', fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  statusBox: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#333', padding: 8, borderRadius: 5, marginBottom: 8 },
  statusLabel: { color: '#ccc', fontSize: 13 },
  statusValue: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  guideTitle: { fontSize: 14, color: '#fff', fontWeight: 'bold', marginTop: 8, marginBottom: 4 },
  guideText: { color: '#aaa', fontSize: 12, marginBottom: 3 },
  logsContainer: { backgroundColor: '#111', height: 100, padding: 6, borderRadius: 5, marginBottom: 8, borderWidth: 1, borderColor: '#333' },
  logText: { color: '#0ff', fontSize: 11, fontFamily: 'monospace', marginBottom: 2 },
  networkMapButton: { alignItems: 'center', backgroundColor: '#58e3e4', borderRadius: 8, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 10, padding: 11 },
  networkMapButtonText: { color: '#08222e', fontSize: 14, fontWeight: '800' },
  networkMapContainer: { backgroundColor: '#172936', borderColor: '#3c5e69', borderRadius: 14, borderWidth: 1, maxHeight: '88%', padding: 16, width: '94%' },
  networkMapHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  networkMapCaption: { color: '#9fb8c0', fontSize: 12, lineHeight: 17, maxWidth: 270 },
  networkMapClose: { alignItems: 'center', height: 38, justifyContent: 'center', width: 38 },
  networkMapCanvas: { backgroundColor: '#0c1c28', borderColor: '#2e5366', borderRadius: 12, borderWidth: 1, marginTop: 14, minHeight: 260, overflow: 'hidden', padding: 12 },
  mapRootNode: { alignItems: 'center', alignSelf: 'center', backgroundColor: '#58e3e4', borderRadius: 12, minWidth: 142, paddingHorizontal: 14, paddingVertical: 10 },
  mapRootTitle: { color: '#08222e', fontSize: 14, fontWeight: '800', marginTop: 3 },
  mapRootSubtitle: { color: '#1e5662', fontSize: 11, marginTop: 2 },
  mapConnector: { alignSelf: 'center', backgroundColor: '#58e3e4', height: 18, opacity: 0.55, width: 2 },
  networkNodeList: { maxHeight: 290 },
  networkNodeListContent: { gap: 8, paddingBottom: 2 },
  networkNode: { alignItems: 'center', backgroundColor: '#142a37', borderColor: '#2d4d59', borderRadius: 10, borderWidth: 1, flexDirection: 'row', minHeight: 58, paddingHorizontal: 9, paddingVertical: 8 },
  networkCameraNode: { borderColor: '#58e3e4', backgroundColor: '#173743' },
  networkNodeIcon: { alignItems: 'center', backgroundColor: '#1d4655', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  networkNodeDetails: { flex: 1, marginLeft: 10 },
  networkNodeRole: { color: '#e2f5f7', fontSize: 13, fontWeight: '700' },
  networkNodeHost: { color: '#8faab3', fontFamily: 'monospace', fontSize: 11, marginTop: 3 },
  networkNodeHealth: { alignItems: 'flex-end', gap: 3 },
  onlineDot: { backgroundColor: '#51e2a2', borderRadius: 5, height: 9, width: 9 },
  networkNodeLatency: { color: '#8faab3', fontSize: 10 },
  networkEmptyState: { alignItems: 'center', justifyContent: 'center', minHeight: 170, paddingHorizontal: 20 },
  networkEmptyTitle: { color: '#dcecef', fontSize: 15, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  networkEmptyText: { color: '#8faab3', fontSize: 12, lineHeight: 17, marginTop: 5, textAlign: 'center' },
  networkScanStatus: { color: '#b8d6dc', fontSize: 12, lineHeight: 17, marginTop: 10, minHeight: 17 },
  scanProgressTrack: { backgroundColor: '#2b4652', borderRadius: 3, height: 5, marginTop: 7, overflow: 'hidden' },
  scanProgressBar: { backgroundColor: '#58e3e4', borderRadius: 3, height: 5 },
  networkMapActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  scanNetworkButton: { alignItems: 'center', backgroundColor: '#58e3e4', borderRadius: 7, flex: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 42, paddingHorizontal: 10 },
  scanNetworkButtonText: { color: '#08222e', fontSize: 13, fontWeight: '800' },
  closeMapButton: { alignItems: 'center', backgroundColor: '#4c5a61', borderRadius: 7, flex: 1, justifyContent: 'center', minHeight: 42, padding: 11 },
  networkMapHint: { color: '#7f9aa3', fontSize: 10, lineHeight: 15, marginTop: 10 },
  closeButton: { backgroundColor: '#dc3545', padding: 10, borderRadius: 5, marginTop: 10, alignItems: 'center' },
  closeButtonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' }
});
