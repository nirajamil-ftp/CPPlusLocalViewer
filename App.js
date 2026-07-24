import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';

export default function App() {
  const serverUrl = 'http://192.168.1.100:8080';
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    let timer;
    if (showControls) {
      timer = setTimeout(() => {
        setShowControls(false);
      }, 4000);
    }
    return () => clearTimeout(timer);
  }, [showControls]);

  const handlePTZ = (action) => {
    console.log(`PTZ Action: ${action}`);
  };

  const handleCall = () => {
    console.log('Call feature triggered');
  };

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: serverUrl }}
        style={styles.webview}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
      />
      <TouchableOpacity 
        style={styles.toggleButton} 
        onPress={() => setShowControls(!showControls)}
      >
        <Text style={styles.toggleText}>{showControls ? '✕' : '⚙️'}</Text>
      </TouchableOpacity>
      {showControls && (
        <View style={styles.overlayContainer}>
          <Text style={styles.title}>Neeraj's CamView</Text>
          <View style={styles.controlsGroup}>
            <TouchableOpacity style={styles.button} onPress={() => handlePTZ('Up')}>
              <Text style={styles.buttonText}>▲</Text>
            </TouchableOpacity>
            <View style={styles.row}>
              <TouchableOpacity style={styles.button} onPress={() => handlePTZ('Left')}>
                <Text style={styles.buttonText}>◄</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={() => handlePTZ('Right')}>
                <Text style={styles.buttonText}>►</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.button} onPress={() => handlePTZ('Down')}>
              <Text style={styles.buttonText}>▼</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.callButton} onPress={handleCall}>
            <Text style={styles.callButtonText}>📞 Call / Intercom</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
  toggleButton: { position: 'absolute', top: 40, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 25, borderWidth: 1, borderColor: '#fff' },
  toggleText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  overlayContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 5 },
  title: { fontSize: 20, color: '#fff', fontWeight: 'bold', marginBottom: 20 },
  controlsGroup: { alignItems: 'center', marginBottom: 20 },
  row: { flexDirection: 'row', marginVertical: 5 },
  button: { backgroundColor: 'rgba(51,51,51,0.8)', paddingVertical: 12, paddingHorizontal: 20, margin: 5, borderRadius: 5, borderWidth: 1, borderColor: '#fff' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  callButton: { backgroundColor: '#28a745', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 5 },
  callButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
