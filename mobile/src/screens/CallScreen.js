import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RTCView } from 'react-native-webrtc';
import { useCall } from '../context/CallContext';
import { useTheme } from '../context/ThemeContext';

export default function CallScreen({ navigation }) {
  const {
    callState, callType, remoteUser, localStream, remoteStream,
    isMuted, isCameraOff,
    acceptCall, rejectCall, hangUp,
    onToggleMute, onToggleCamera, onSwitchCamera,
  } = useCall();
  const { theme } = useTheme();

  // Navigate back when call ends
  useEffect(() => {
    if (callState === 'idle') {
      navigation.goBack();
    }
  }, [callState]);

  const isVideo = callType === 'video';
  const name = remoteUser?.display_name || 'Unknown';
  const initial = name[0]?.toUpperCase() || '?';
  const avatarUrl = remoteUser?.avatar_url;

  const statusText = callState === 'outgoing' ? 'Calling...'
    : callState === 'incoming' ? 'Incoming call...'
    : callState === 'connected' ? 'Connected'
    : '';

  // Incoming call screen
  if (callState === 'incoming') {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        <View style={s.infoSection}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.avatarPlaceholder, { backgroundColor: theme.accent }]}>
              <Text style={s.avatarText}>{initial}</Text>
            </View>
          )}
          <Text style={[s.name, { color: theme.text }]}>{name}</Text>
          <Text style={[s.status, { color: theme.textMuted }]}>
            Incoming {isVideo ? 'video' : 'voice'} call...
          </Text>
        </View>
        <View style={s.incomingActions}>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#dc3545' }]} onPress={rejectCall}>
            <Text style={s.actionIcon}>✕</Text>
            <Text style={s.actionLabel}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#28a745' }]} onPress={acceptCall}>
            <Text style={s.actionIcon}>✓</Text>
            <Text style={s.actionLabel}>Accept</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Connected video call
  if (callState === 'connected' && isVideo) {
    return (
      <View style={s.videoContainer}>
        {/* Remote video (full screen) */}
        {remoteStream ? (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={s.remoteVideo}
            objectFit="cover"
          />
        ) : (
          <View style={[s.remoteVideo, { backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: theme.textMuted }}>Connecting video...</Text>
          </View>
        )}

        {/* Local video (small overlay) */}
        {localStream && !isCameraOff && (
          <View style={s.localVideoWrap}>
            <RTCView
              streamURL={localStream.toURL()}
              style={s.localVideo}
              objectFit="cover"
              mirror={true}
            />
          </View>
        )}

        {/* Name overlay */}
        <View style={s.videoNameOverlay}>
          <Text style={s.videoName}>{name}</Text>
        </View>

        {/* Controls */}
        <SafeAreaView style={s.videoControls} edges={['bottom']}>
          <TouchableOpacity style={[s.controlBtn, isMuted && s.controlActive]} onPress={onToggleMute}>
            <Text style={s.controlIcon}>{isMuted ? '🔇' : '🎤'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.controlBtn, isCameraOff && s.controlActive]} onPress={onToggleCamera}>
            <Text style={s.controlIcon}>{isCameraOff ? '📷' : '📹'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.controlBtn} onPress={onSwitchCamera}>
            <Text style={s.controlIcon}>🔄</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.controlBtn, { backgroundColor: '#dc3545' }]} onPress={hangUp}>
            <Text style={s.controlIcon}>✕</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // Outgoing call or connected voice call
  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
      <View style={s.infoSection}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarPlaceholder, { backgroundColor: theme.accent }]}>
            <Text style={s.avatarText}>{initial}</Text>
          </View>
        )}
        <Text style={[s.name, { color: theme.text }]}>{name}</Text>
        <Text style={[s.status, { color: theme.textMuted }]}>{statusText}</Text>
      </View>

      <View style={s.controls}>
        <TouchableOpacity style={[s.controlBtn, isMuted && s.controlActive]} onPress={onToggleMute}>
          <Text style={s.controlIcon}>{isMuted ? '🔇' : '🎤'}</Text>
          <Text style={[s.controlLabel, { color: theme.textMuted }]}>
            {isMuted ? 'Unmute' : 'Mute'}
          </Text>
        </TouchableOpacity>

        {isVideo && (
          <>
            <TouchableOpacity style={[s.controlBtn, isCameraOff && s.controlActive]} onPress={onToggleCamera}>
              <Text style={s.controlIcon}>{isCameraOff ? '📷' : '📹'}</Text>
              <Text style={[s.controlLabel, { color: theme.textMuted }]}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.controlBtn} onPress={onSwitchCamera}>
              <Text style={s.controlIcon}>🔄</Text>
              <Text style={[s.controlLabel, { color: theme.textMuted }]}>Flip</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={[s.controlBtn, { backgroundColor: '#dc3545' }]} onPress={hangUp}>
          <Text style={s.controlIcon}>✕</Text>
          <Text style={[s.controlLabel, { color: '#fff' }]}>End</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between' },
  infoSection: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 48 },
  name: { fontSize: 24, fontWeight: '600', marginTop: 20 },
  status: { fontSize: 16, marginTop: 8 },
  incomingActions: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 40, paddingBottom: 60 },
  actionBtn: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  actionIcon: { color: '#fff', fontSize: 28, fontWeight: '700' },
  actionLabel: { color: '#fff', fontSize: 12, marginTop: 4 },
  controls: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 20, paddingBottom: 50 },
  controlBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  controlActive: { backgroundColor: 'rgba(255,255,255,0.35)' },
  controlIcon: { fontSize: 24 },
  controlLabel: { fontSize: 11, marginTop: 2 },
  // Video call styles
  videoContainer: { flex: 1, backgroundColor: '#000' },
  remoteVideo: { flex: 1 },
  localVideoWrap: { position: 'absolute', top: 60, right: 16, width: 120, height: 160, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: '#fff' },
  localVideo: { flex: 1 },
  videoNameOverlay: { position: 'absolute', top: 60, left: 16 },
  videoName: { color: '#fff', fontSize: 18, fontWeight: '600', textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 4 },
  videoControls: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 30, paddingBottom: 20, paddingTop: 16, backgroundColor: 'rgba(0,0,0,0.5)' },
});
