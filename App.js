import React, { useState } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import Video from 'react-native-video';

const STREAM_URL = "rtsp://admin:krishna2547@192.168.1.100:5543/live/channel0";

export default function App() {
  const [status, setStatus] = useState("कनेक्ट हो रहा है...");

  return (
    <View style={styles.container}>
      <Text style={styles.statusText}>स्थिति: {status}</Text>
      <Video
        source={{ uri: STREAM_URL, type: 'rtsp' }}
        style={styles.fullVideo}
        controls={false}
        resizeMode="contain"
        onLoad={() => setStatus("लाइव फ़ीड चालू है 🟢")}
        onError={(e) => setStatus("कनेक्शन एरर: कैमरा नेटवर्क जाँचें")}
        useTextureView={true}
        bufferConfig={{
          minBufferMs: 100,
          maxBufferMs: 500,
          bufferForPlaybackMs: 100,
          bufferForPlaybackAfterRebufferMs: 200
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  statusText: { color: '#00FF00', fontSize: 14, marginBottom: 10 },
  fullVideo: { width: Dimensions.get('window').width, height: 250 },
});
