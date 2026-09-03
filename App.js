import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput, 
  Modal, 
  ScrollView, 
  Dimensions, 
  Alert,
  Platform 
} from 'react-native';
import Video from 'react-native-video';
import * as Updates from 'expo-updates';

export default function App() {
  const [cameras, setCameras] = useState([
    {
      id: '1',
      name: 'CP Plus Cam 1',
      ip: '192.168.1.100',
      onvifIp: '192.168.1.100',
      port: '5543',
      username: 'admin',
      password: 'krishna2547',
      channel: 'live/channel0'
    }
  ]);

  const [selectedCamIndex, setSelectedCamIndex] = useState(0);
  const [status, setStatus] = useState("कनेक्ट हो रहा है...");
  const [updating, setUpdating] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const [camName, setCamName] = useState('');
  const [ip, setIp] = useState('');
  const [onvifIp, setOnvifIp] = useState('');
  const [port, setPort] = useState('5543');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [channel, setChannel] = useState('live/channel0');
  const [editingId, setEditingId] = useState(null);

  const activeCam = cameras[selectedCamIndex] || cameras[0];
  const streamUrl = `rtsp://${activeCam.username}:${activeCam.password}@${activeCam.ip}:${activeCam.port}/${activeCam.channel}`;

  const openSettingsModal = () => {
    if (activeCam) {
      setEditingId(activeCam.id);
      setCamName(activeCam.name);
      setIp(activeCam.ip);
      setOnvifIp(activeCam.onvifIp || activeCam.ip);
      setPort(activeCam.port);
      setUsername(activeCam.username);
      setPassword(activeCam.password);
      setChannel(activeCam.channel);
    }
    setModalVisible(true);
  };

  const startAddNewCamera = () => {
    setEditingId(null);
    setCamName(`Cam ${cameras.length + 1}`);
    setIp('192.168.1.101');
    setOnvifIp('192.168.1.101');
    setPort('5543');
    setUsername('admin');
    setPassword('krishna2547');
    setChannel('live/channel0');
  };

  const saveCameraSettings = () => {
    if (!ip || !username || !password) {
      Alert.alert("एरर", "कृपया IP, Username और Password सही से भरें");
      return;
    }

    if (editingId) {
      const updated = cameras.map(cam => {
        if (cam.id === editingId) {
          return { ...cam, name: camName, ip, onvifIp, port, username, password, channel };
        }
        return cam;
      });
      setCameras(updated);
    } else {
      const newCam = {
        id: Date.now().toString(),
        name: camName,
        ip,
        onvifIp,
        port,
        username,
        password,
        channel
      };
      setCameras([...cameras, newCam]);
      setSelectedCamIndex(cameras.length);
    }

    setModalVisible(false);
    setStatus("कैमरा कॉन्फ़िगरेशन अपडेट हुआ 🟢");
  };

  const onCheckUpdate = async () => {
    if (Platform.OS === 'web') {
      alert("वेब पर OTA अपडेट काम नहीं करता। इसे APK में टेस्ट करें।");
      return;
    }
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
      <View style={styles.header}>
        <Text style={styles.title}>CP Plus Viewer</Text>
        <TouchableOpacity style={styles.settingsBtn} onPress={openSettingsModal}>
          <Text style={styles.btnTextText}>⚙️ सेटिंग्स</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal style={styles.camSelector} showsHorizontalScrollIndicator={false}>
        {cameras.map((cam, index) => (
          <TouchableOpacity
            key={cam.id}
            style={[styles.camTab, selectedCamIndex === index && styles.activeTab]}
            onPress={() => setSelectedCamIndex(index)}
          >
            <Text style={styles.camTabText}>{cam.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.statusText}>
        {activeCam.name} ({activeCam.ip}) - {status}
      </Text>

      {Platform.OS === 'web' ? (
        <View style={[styles.fullVideo, styles.webPlaceholder]}>
          <Text style={{ color: '#FFCC00', textAlign: 'center', padding: 20 }}>
            ⚠️ वेब ब्राउज़र RTSP लाइव फ़ीड सपोर्ट नहीं करता।{"\n"}
            लाइव स्ट्रीम देखने के लिए Oppo फ़ोन में APK का इस्तेमाल करें।
          </Text>
        </View>
      ) : (
        <Video
          key={streamUrl}
          source={{ uri: streamUrl, type: 'rtsp' }}
          style={styles.fullVideo}
          controls={false}
          resizeMode="contain"
          muted={true}
          onLoad={() => setStatus("लाइव फ़ीड चालू है 🟢")}
          onError={() => setStatus("कनेक्शन एरर: IP या नेटवर्क जाँचें")}
          useTextureView={true}
          bufferConfig={{
            minBufferMs: 100,
            maxBufferMs: 500,
            bufferForPlaybackMs: 100,
            bufferForPlaybackAfterRebufferMs: 200
          }}
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView style={{ width: '100%' }}>
              <Text style={styles.modalTitle}>⚙️ ऐप सेटिंग्स</Text>

              <TouchableOpacity style={styles.addCamModalBtn} onPress={startAddNewCamera}>
                <Text style={styles.addCamModalBtnText}>➕ नया कैमरा जोड़ें</Text>
              </TouchableOpacity>

              <Text style={styles.sectionHeader}>
                {editingId ? `कैमरा सेटिंग्स: ${camName}` : "नया कैमरा कॉन्फ़िगरेशन"}
              </Text>

              <Text style={styles.label}>कैमरा का नाम:</Text>
              <TextInput style={styles.input} value={camName} onChangeText={setCamName} placeholder="Main Gate" placeholderTextColor="#666" />

              <Text style={styles.label}>कैमरा IP Address:</Text>
              <TextInput style={styles.input} value={ip} onChangeText={setIp} placeholder="192.168.1.100" keyboardType="numeric" placeholderTextColor="#666" />

              <Text style={styles.label}>ONVIF IP Address:</Text>
              <TextInput style={styles.input} value={onvifIp} onChangeText={setOnvifIp} placeholder="192.168.1.100" keyboardType="numeric" placeholderTextColor="#666" />

              <Text style={styles.label}>RTSP Port:</Text>
              <TextInput style={styles.input} value={port} onChangeText={setPort} placeholder="5543" keyboardType="numeric" placeholderTextColor="#666" />

              <Text style={styles.label}>Username:</Text>
              <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="admin" placeholderTextColor="#666" />

              <Text style={styles.label}>Password:</Text>
              <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry={true} placeholder="krishna2547" placeholderTextColor="#666" />

              <Text style={styles.label}>Stream Channel Path:</Text>
              <TextInput style={styles.input} value={channel} onChangeText={setChannel} placeholder="live/channel0" placeholderTextColor="#666" />

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.actionBtn, styles.saveBtn]} onPress={saveCameraSettings}>
                  <Text style={styles.btnTextText}>सेव करें</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={() => setModalVisible(false)}>
                  <Text style={styles.btnTextText}>रद्द करें</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              <Text style={styles.sectionHeader}>सिस्टम अपडेट</Text>
              <TouchableOpacity 
                style={styles.updateButton} 
                onPress={onCheckUpdate}
                disabled={updating}
              >
                <Text style={styles.buttonText}>
                  {updating ? "चेक हो रहा है..." : "🔄 Pull / Check Update"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', paddingTop: 40, alignItems: 'center' },
  header: { flexDirection: 'row', width: '90%', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  settingsBtn: { backgroundColor: '#333', padding: 8, borderRadius: 6 },
  camSelector: { maxHeight: 40, width: '90%', marginBottom: 10 },
  camTab: { backgroundColor: '#222', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  activeTab: { backgroundColor: '#1E88E5' },
  camTabText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  statusText: { color: '#00FF00', fontSize: 12, marginBottom: 10, textAlign: 'center' },
  fullVideo: { width: Dimensions.get('window').width, height: 240, backgroundColor: '#000' },
  webPlaceholder: { justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#555' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '88%', maxHeight: '85%', backgroundColor: '#1E1E1E', borderRadius: 12, padding: 20 },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  addCamModalBtn: { backgroundColor: '#2E7D32', padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 15 },
  addCamModalBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  sectionHeader: { color: '#1E88E5', fontSize: 14, fontWeight: 'bold', marginTop: 10, marginBottom: 5 },
  label: { color: '#BBB', fontSize: 12, marginTop: 8 },
  input: { backgroundColor: '#2A2A2A', color: '#FFF', padding: 10, borderRadius: 6, marginTop: 4, fontSize: 14 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  actionBtn: { flex: 1, padding: 12, borderRadius: 6, alignItems: 'center', marginHorizontal: 5 },
  saveBtn: { backgroundColor: '#2E7D32' },
  cancelBtn: { backgroundColor: '#D32F2F' },
  btnTextText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  divider: { height: 1, backgroundColor: '#333', marginVertical: 20 },
  updateButton: { paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#1E88E5', borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' }
});
