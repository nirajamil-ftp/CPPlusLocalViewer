import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';

export default function App() {
  const serverUrl = 'http://10.25.78.88:8080';
  const [showControls, setShowControls] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [signalStrength, setSignalStrength] = useState('Checking...');
  const [diagnosticLogs, setDiagnosticLogs] = useState([]);
  const [webViewKey, setWebViewKey] = useState(0);
  const [webViewError, setWebViewError] = useState(null);

  const addLog = (message) => {
    const time = new Date().toLocaleTimeString();
    setDiagnosticLogs(prev => [`[${time}] ${message}`, ...prev.slice(0, 15)]);
  };

  useEffect(() => {
    let timer;
    if (showControls) {
      timer = setTimeout(() => {
        setShowControls(false);
      }, 4000);
    }
    return () => clearTimeout(timer);
  }, [showControls]);

  useEffect(() => {
    const checkConnection = async () => {
      addLog('Pinging server...');
      try {
        const start = Date.now();
        const response = await fetch(serverUrl, { method: 'HEAD' });
        const latency = Date.now() - start;
        if (response.ok) {
          setIsConnected(true);
          addLog(`Success! Latency: ${latency}ms`);
          if (latency < 100) setSignalStrength(`Excellent (${latency}ms)`);
          else if (latency < 300) setSignalStrength(`Good (${latency}ms)`);
          else setSignalStrength(`Weak (${latency}ms)`);
        } else {
          setIsConnected(false);
          addLog(`Server responded with status: ${response.status}`);
          setSignalStrength('Disconnected');
        }
      } catch (error) {
        setIsConnected(false);
        addLog(`Connection Error: ${error.message}`);
        setSignalStrength('No Connection');
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  const handlePTZ = (action) => {
    console.log(`PTZ Action: ${action}`);
  };

  const retryWebView = () => {
    setWebViewError(null);
    setWebViewKey((currentKey) => currentKey + 1);
  };

  return (
    <View style={styles.container}>
      <WebView
        key={webViewKey}
        source={{ uri: serverUrl }}
        style={styles.webview}
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
          <View style={styles.errorState}>
            <Text style={styles.errorTitle}>Unable to load camera page</Text>
            <Text style={styles.errorMessage}>
              Confirm that your phone and camera server are on the same Wi-Fi network.
            </Text>
            <Text style={styles.errorDetail}>
              {webViewError || `Server: ${serverUrl}`}
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={retryWebView}>
              <Text style={styles.retryButtonText}>Retry connection</Text>
            </TouchableOpacity>
          </View>
        )}
      />
      <View style={styles.topBar}>
        <TouchableOpacity 
          style={styles.helpButton} 
          onPress={() => setShowHelp(true)}
        >
          <Text style={styles.helpText}>❓ Diagnostics & Help</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.toggleButton} 
          onPress={() => setShowControls(!showControls)}
        >
          <Text style={styles.toggleText}>{showControls ? '✕' : '⚙️'}</Text>
        </TouchableOpacity>
      </View>

      {showControls && (
        <View style={styles.overlayContainer}>
          <Text style={styles.title}>Neeraj's CamView (PTZ)</Text>
          <View style={styles.controlsGroup}>
            <TouchableOpacity style={styles.button} onPress={() => handlePTZ('Pan Up')}>
              <Text style={styles.buttonText}>▲</Text>
            </TouchableOpacity>
            <View style={styles.row}>
              <TouchableOpacity style={styles.button} onPress={() => handlePTZ('Pan Left')}>
                <Text style={styles.buttonText}>◄</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={() => handlePTZ('Pan Right')}>
                <Text style={styles.buttonText}>►</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.button} onPress={() => handlePTZ('Pan Down')}>
              <Text style={styles.buttonText}>▼</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.zoomGroup}>
            <TouchableOpacity style={styles.zoomButton} onPress={() => handlePTZ('Zoom In')}>
              <Text style={styles.buttonText}>Zoom +</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.zoomButton} onPress={() => handlePTZ('Zoom Out')}>
              <Text style={styles.buttonText}>Zoom -</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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

            <Text style={styles.guideTitle}>Wi-Fi Setup Guide:</Text>
            <Text style={styles.guideText}>1. Connect phone and PC to the same local Wi-Fi.</Text>
            <Text style={styles.guideText}>2. Verify server IP: http://10.25.78.88:8080</Text>

            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => setShowHelp(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
  errorState: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  errorMessage: { color: '#ccc', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 12 },
  errorDetail: { color: '#999', fontSize: 12, textAlign: 'center', marginBottom: 18 },
  retryButton: { backgroundColor: '#007bff', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  retryButtonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  topBar: { position: 'absolute', top: 40, right: 20, left: 20, flexDirection: 'row', justifyContent: 'space-between', zIndex: 10 },
  toggleButton: { backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 25, borderWidth: 1, borderColor: '#fff' },
  toggleText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  helpButton: { backgroundColor: 'rgba(0,123,255,0.8)', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 20, borderWidth: 1, borderColor: '#fff' },
  helpText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  overlayContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 5 },
  title: { fontSize: 20, color: '#fff', fontWeight: 'bold', marginBottom: 15 },
  controlsGroup: { alignItems: 'center', marginBottom: 15 },
  row: { flexDirection: 'row', marginVertical: 5 },
  button: { backgroundColor: 'rgba(51,51,51,0.9)', paddingVertical: 10, paddingHorizontal: 18, margin: 4, borderRadius: 5, borderWidth: 1, borderColor: '#fff' },
  zoomGroup: { flexDirection: 'row', marginTop: 10 },
  zoomButton: { backgroundColor: 'rgba(0,123,255,0.9)', paddingVertical: 8, paddingHorizontal: 15, marginHorizontal: 5, borderRadius: 5, borderWidth: 1, borderColor: '#fff' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '90%', maxHeight: '85%', backgroundColor: '#222', borderRadius: 10, padding: 15, borderWidth: 1, borderColor: '#444' },
  modalTitle: { fontSize: 18, color: '#fff', fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  statusBox: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#333', padding: 8, borderRadius: 5, marginBottom: 8 },
  statusLabel: { color: '#ccc', fontSize: 13 },
  statusValue: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  guideTitle: { fontSize: 14, color: '#fff', fontWeight: 'bold', marginTop: 8, marginBottom: 4 },
  guideText: { color: '#aaa', fontSize: 12, marginBottom: 3 },
  logsContainer: { backgroundColor: '#111', height: 100, padding: 6, borderRadius: 5, marginBottom: 8, borderWidth: 1, borderColor: '#333' },
  logText: { color: '#0ff', fontSize: 11, fontFamily: 'monospace', marginBottom: 2 },
  closeButton: { backgroundColor: '#dc3545', padding: 10, borderRadius: 5, marginTop: 10, alignItems: 'center' },
  closeButtonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' }
});
