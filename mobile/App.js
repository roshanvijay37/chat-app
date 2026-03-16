import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { View, ActivityIndicator } from 'react-native';

import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import ConversationsScreen from './src/screens/ConversationsScreen';
import ChatScreen from './src/screens/ChatScreen';
import NewChatScreen from './src/screens/NewChatScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ViewProfileScreen from './src/screens/ViewProfileScreen';

const Stack = createStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Conversations" component={ConversationsScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="NewChat" component={NewChatScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="ViewProfile" component={ViewProfileScreen} />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();
  const { theme, isDark } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NavigationContainer>
        {user ? <AppStack /> : <AuthStack />}
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
