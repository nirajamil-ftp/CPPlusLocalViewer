import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';

export default function App() {
  const serverUrl = 'http://10.25.78.88:8080';
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
  toggleButton: { position: 'absolute', top: 40, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 25, borderWidth: 1, borderColor: '#fff' },
  toggleText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  overlayContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 5 },
  title: { fontSize: 20, color: '#fff', fontWeight: 'bold', marginBottom: 15 },
  controlsGroup: { alignItems: 'center', marginBottom: 15 },
  row: { flexDirection: 'row', marginVertical: 5 },
  button: { backgroundColor: 'rgba(51,51,51,0.9)', paddingVertical: 10, paddingHorizontal: 18, margin: 4, borderRadius: 5, borderWidth: 1, borderColor: '#fff' },
  zoomGroup: { flexDirection: 'row', marginTop: 10 },
  zoomButton: { backgroundColor: 'rgba(0,123,255,0.9)', paddingVertical: 8, paddingHorizontal: 15, marginHorizontal: 5, borderRadius: 5, borderWidth: 1, borderColor: '#fff' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
