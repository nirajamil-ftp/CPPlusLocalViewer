import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal } from 'react-native';
import { WebView } from 'react-native-webview';

export default function App() {
  const serverUrl = 'http://10.25.78.88:8080';
  const [showControls, setShowControls] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [signalStrength, setSignalStrength] = useState('Checking...');

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
      try {
        const start = Date.now();
        const response = await fetch(serverUrl, { method: 'HEAD' });
        const latency = Date.now() - start;
        if (response.ok) {
          setIsConnected(true);
          if (latency < 100) setSignalStrength('Excellent (Strong Wi-Fi)');
          else if (latency < 300) setSignalStrength('Good (Stable)');
          else setSignalStrength('Weak (High Latency)');
        } else {
          setIsConnected(false);
          setSignalStrength('Disconnected');
        }
      } catch (error) {
        setIsConnected(false);
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

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: serverUrl }}
        style={styles.webview}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
      />
      <View style={styles.topBar}>
        <TouchableOpacity 
          style={styles.helpButton} 
          onPress={() => setShowHelp(true)}
        >
          <Text style={styles.helpText}>❓ Help</Text>
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
            <Text style={styles.modalTitle}>Connection & Help Guide</Text>
            
            <View style={styles.statusBox}>
              <Text style={styles.statusLabel}>Connection Status:</Text>
              <Text style={[styles.statusValue, { color: isConnected ? '#28a745' : '#dc3545' }]}>
                {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
              </Text>
            </View>

            <View style={styles.statusBox}>
              <Text style={styles.statusLabel}>Signal Strength:</Text>
              <Text style={styles.statusValue}>{signalStrength}</Text>
            </View>

            <Text style={styles.guideTitle}>Wi-Fi Setup Guide:</Text>
            <Text style={styles.guideText}>1. Ensure your phone is connected to the same local Wi-Fi router as your PC/Server.</Text>
            <Text style={styles.guideText}>2. Verify that the Python streaming server is running on IP: 10.25.78.88:8080.</Text>
            <Text style={styles.guideText}>3. If connection fails, restart stream.py on your PC and check firewall settings.</Text>

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
  topBar: { position: 'absolute', top: 40, right: 20, left: 20, flexDirection: 'row', justifyContent: 'space-between', zIndex: 10 },
  toggleButton: { backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 25, borderWidth: 1, borderColor: '#fff' },
  toggleText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  helpButton: { backgroundColor: 'rgba(0,123,255,0.8)', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 20, borderWidth: 1, borderColor: '#fff' },
  helpText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  overlayContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 5 },
  title: { fontSize: 20, color: '#fff', fontWeight: 'bold', marginBottom: 15 },
  controlsGroup: { alignItems: 'center', marginBottom: 15 },
  row: { flexDirection: 'row', marginVertical: 5 },
  button: { backgroundColor: 'rgba(51,51,51,0.9)', paddingVertical: 10, paddingHorizontal: 18, margin: 4, borderRadius: 5, borderWidth: 1, borderColor: '#fff' },
  zoomGroup: { flexDirection: 'row', marginTop: 10 },
  zoomButton: { backgroundColor: 'rgba(0,123,255,0.9)', paddingVertical: 8, paddingHorizontal: 15, marginHorizontal: 5, borderRadius: 5, borderWidth: 1, borderColor: '#fff' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '85%', backgroundColor: '#222', borderRadius: 10, padding: 20, borderWidth: 1, borderColor: '#444' },
  modalTitle: { fontSize: 20, color: '#fff', fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  statusBox: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#333', padding: 10, borderRadius: 5, marginBottom: 10 },
  statusLabel: { color: '#ccc', fontSize: 14 },
  statusValue: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  guideTitle: { fontSize: 16, color: '#fff', fontWeight: 'bold', marginTop: 10, marginBottom: 5 },
  guideText: { color: '#aaa', fontSize: 13, marginBottom: 5, lineHeight: 18 },
  closeButton: { backgroundColor: '#dc3545', padding: 10, borderRadius: 5, marginTop: 15, alignItems: 'center' },
  closeButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
