import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

const lightTheme = {
  bg: '#ffffff',
  bgSecondary: '#f5f5f5',
  bgTertiary: '#e8e8e8',
  bgInput: '#ffffff',
  text: '#111111',
  textSecondary: '#555555',
  textMuted: '#8696a0',
  border: '#dddddd',
  borderLight: '#eeeeee',
  accent: '#00a884',
  msgMine: '#d9fdd3',
  msgMineText: '#111111',
  msgTheirs: '#ffffff',
  msgTheirsText: '#111111',
  readBlue: '#53bdeb',
  tickDefault: '#667781',
  error: '#dc3545',
  groupColor: '#6c5ce7',
};

const darkTheme = {
  bg: '#0b141a',
  bgSecondary: '#111b21',
  bgTertiary: '#202c33',
  bgInput: '#2a3942',
  text: '#e9edef',
  textSecondary: '#d1d7db',
  textMuted: '#8696a0',
  border: '#313d45',
  borderLight: '#222e35',
  accent: '#00a884',
  msgMine: '#005c4b',
  msgMineText: '#e9edef',
  msgTheirs: '#202c33',
  msgTheirsText: '#e9edef',
  readBlue: '#53bdeb',
  tickDefault: '#8696a0',
  error: '#ff6b6b',
  groupColor: '#6c5ce7',
};

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('theme').then((v) => {
      if (v === 'dark') setIsDark(true);
    });
  }, []);

  const toggleTheme = async () => {
    const next = !isDark;
    setIsDark(next);
    await AsyncStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
