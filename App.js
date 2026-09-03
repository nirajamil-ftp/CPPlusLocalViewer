import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, Alert } from 'react-native';
import Video from 'react-native-video';
import * as Updates from 'expo-updates';

const STREAM_URL = "rtsp://admin:krishna2547@192.168.1.100:5543/live/channel0";

export default function App() {
  const [status, setStatus] = useState("कनेक्ट हो रहा है...");
  const [updating, setUpdating] = useState(false);

  const onCheckUpdate = async () => {
    try {
      setUpdating(true);
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        setStatus("नया अपडेट डाउनलोड हो रहा है...");
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      } else {
        Alert.alert("अपडेट स्टेटस", "आपका ऐप पहले से ही लेटेस्ट वर्ज़न पर है।");
      }
    } catch (error) {
      Alert.alert("एरर", `अपडेट चेक करने में समस्या आई: ${error.message}`);
    } finally {
      setUpdating(false);
    }
  };

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

      <TouchableOpacity 
        style={styles.updateButton} 
        onPress={onCheckUpdate}
        disabled={updating}
      >
        <Text style={styles.buttonText}>
          {updating ? "चेक हो रहा है..." : "🔄 Pull / Check Update"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  statusText: { color: '#00FF00', fontSize: 14, marginBottom: 10 },
  fullVideo: { width: Dimensions.get('window').width, height: 250 },
  updateButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#1E88E5',
    borderRadius: 8,
  },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
