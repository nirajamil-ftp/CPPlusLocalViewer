import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { VlcPlayer } from 'react-native-vlc-media-player';
import * as Network from 'expo-network';

export default function App() {
  const [ip, setIp] = useState('192.168.1.');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [onvifPort, setOnvifPort] = useState('80');
  const [url, setUrl] = useState('');
  const [networkInfo, setNetworkInfo] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);

  const handleConnect = () => {
    const streamUrl = `rtsp://${username}:${password}@${ip}:554/cam/realmonitor?channel=1&subtype=1`;
    setUrl(streamUrl);
    setIsPlaying(true);
  };

  const checkNetwork = async () => {
    try {
      const ipAddress = await Network.getIpAddressAsync();
      const state = await Network.getNetworkStateAsync();
      setNetworkInfo(`Device IP: ${ipAddress}\nConnected: ${state.isConnected}\nType: ${state.type}`);
    } catch (error) {
      setNetworkInfo('Network check failed: ' + error.message);
    }
  };

  const sendPtzCommand = async (command) => {
    try {
      console.log(`Sending PTZ: ${command} to http://${ip}:${onvifPort}`);
    } catch (error) {
      console.error(error);
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>CP Plus Local Viewer & PTZ</Text>
      <TextInput style={styles.input} placeholder="Camera IP Address" placeholderTextColor="#888" value={ip} onChangeText={setIp} />
      <TextInput style={styles.input} placeholder="Username (admin)" placeholderTextColor="#888" value={username} onChangeText={setUsername} />
      <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#888" secureTextEntry value={password} onChangeText={setPassword} />
      <TextInput style={styles.input} placeholder="ONVIF/HTTP Port (e.g. 80)" placeholderTextColor="#888" value={onvifPort} onChangeText={setOnvifPort} />
      
      <TouchableOpacity style={styles.button} onPress={handleConnect}>
        <Text style={styles.buttonText}>Connect & Play</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, {backgroundColor: '#28a745'}]} onPress={checkNetwork}>
        <Text style={styles.buttonText}>Network Troubleshooting / Router IP</Text>
      </TouchableOpacity>

      {networkInfo ? <Text style={styles.infoText}>{networkInfo}</Text> : null}

      {url ? (
        <View style={{width: '100%', alignItems: 'center'}}>
          {isPlaying && (
            <VlcPlayer
              style={styles.video}
              url={url}
              autoplay={true}
              isLive={true}
            />
          )}

          <View style={styles.controlRow}>
            <TouchableOpacity style={styles.smallButton} onPress={() => sendPtzCommand('rewind')}><Text style={styles.btnTxt}>⏪ Rewind</Text></TouchableOpacity>
            <TouchableOpacity style={styles.smallButton} onPress={() => setIsPlaying(!isPlaying)}><Text style={styles.btnTxt}>{isPlaying ? '⏹ Stop' : '▶ Play'}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.smallButton} onPress={() => sendPtzCommand('forward')}><Text style={styles.btnTxt}>⏩ Forward</Text></TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.button, {backgroundColor: isRecording ? '#dc3545' : '#ffc107'}]} onPress={toggleRecording}>
            <Text style={[styles.buttonText, {color: isRecording ? '#fff' : '#000'}]}>{isRecording ? '🔴 Stop Router HDD Recording' : '⏺ Save to Router HDD'}</Text>
          </TouchableOpacity>

          <Text style={styles.subTitle}>Pan & Tilt Controls</Text>
          <View style={styles.ptzContainer}>
            <TouchableOpacity style={styles.ptzButton} onPress={() => sendPtzCommand('up')}><Text style={styles.btnTxt}>⬆️ Up</Text></TouchableOpacity>
            <View style={styles.ptzRow}>
              <TouchableOpacity style={styles.ptzButton} onPress={() => sendPtzCommand('left')}><Text style={styles.btnTxt}>⬅️ Left</Text></TouchableOpacity>
              <TouchableOpacity style={styles.ptzButton} onPress={() => sendPtzCommand('right')}><Text style={styles.btnTxt}>➡️ Right</Text></TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.ptzButton} onPress={() => sendPtzCommand('down')}><Text style={styles.btnTxt}>⬇️ Down</Text></TouchableOpacity>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { color: '#fff', fontSize: 20, marginBottom: 15, fontWeight: 'bold' },
  subTitle: { color: '#fff', fontSize: 16, marginVertical: 10, fontWeight: 'bold' },
  input: { width: '100%', height: 40, backgroundColor: '#222', color: '#fff', marginBottom: 10, paddingHorizontal: 10, borderRadius: 5 },
  button: { width: '100%', height: 45, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', borderRadius: 5, marginBottom: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  infoText: { color: '#0ff', fontSize: 14, marginBottom: 10, textAlign: 'center' },
  video: { width: Dimensions.get('window').width - 40, height: 220, backgroundColor: '#111' },
  controlRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginVertical: 10 },
  smallButton: { flex: 1, height: 40, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', marginHorizontal: 5, borderRadius: 5 },
  btnTxt: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  ptzContainer: { width: '100%', alignItems: 'center', marginTop: 5 },
  ptzRow: { flexDirection: 'row', justifyContent: 'space-between', width: '80%', marginVertical: 5 },
  ptzButton: { width: 90, height: 40, backgroundColor: '#444', justifyContent: 'center', alignItems: 'center', borderRadius: 5 }
});
