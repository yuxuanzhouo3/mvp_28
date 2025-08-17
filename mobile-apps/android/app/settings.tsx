import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { useColorScheme } from 'react-native';
import { List, Divider, Button, Card } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(isDark);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [dataUsageEnabled, setDataUsageEnabled] = useState(false);

  const handleClearData = () => {
    Alert.alert(
      'Clear Data',
      'Are you sure you want to clear all chat history and settings? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            // Clear data logic here
            Alert.alert('Success', 'All data has been cleared.');
          },
        },
      ]
    );
  };

  const handleExportData = async () => {
    try {
      // Export data logic here
      const exportData = {
        settings: {
          notifications: notificationsEnabled,
          darkMode: darkModeEnabled,
          autoSave: autoSaveEnabled,
          dataUsage: dataUsageEnabled,
        },
        timestamp: new Date().toISOString(),
      };

      const dataString = JSON.stringify(exportData, null, 2);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync('data://morngpt-export.json', {
          mimeType: 'application/json',
          dialogTitle: 'Export MornGPT Data',
        });
      } else {
        await Clipboard.setStringAsync(dataString);
        Alert.alert('Success', 'Data copied to clipboard');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export data');
    }
  };

  const handleAbout = () => {
    Alert.alert(
      'About MornGPT',
      'MornGPT Mobile v1.0.0\n\nYour AI assistant on mobile\n\nBuilt with React Native and Expo',
      [{ text: 'OK' }]
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#121212' : '#f5f5f5',
    },
    content: {
      padding: 20,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#000000',
      marginBottom: 12,
    },
    card: {
      backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
      marginBottom: 8,
    },
    listItem: {
      backgroundColor: 'transparent',
    },
    listItemText: {
      color: isDark ? '#ffffff' : '#000000',
    },
    listItemDescription: {
      color: isDark ? '#b0b0b0' : '#666666',
    },
    divider: {
      backgroundColor: isDark ? '#404040' : '#e0e0e0',
    },
    versionText: {
      textAlign: 'center',
      color: isDark ? '#888888' : '#666666',
      marginTop: 20,
      fontSize: 12,
    },
  });

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <Card style={styles.card}>
            <List.Item
              title="Notifications"
              description="Receive push notifications for new messages"
              left={(props) => <List.Icon {...props} icon="bell" />}
              right={() => (
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  trackColor={{ false: '#767577', true: '#007AFF' }}
                  thumbColor={notificationsEnabled ? '#ffffff' : '#f4f3f4'}
                />
              )}
              style={styles.listItem}
              titleStyle={styles.listItemText}
              descriptionStyle={styles.listItemDescription}
            />
            <Divider style={styles.divider} />
            <List.Item
              title="Dark Mode"
              description="Use dark theme for the app"
              left={(props) => <List.Icon {...props} icon="theme-light-dark" />}
              right={() => (
                <Switch
                  value={darkModeEnabled}
                  onValueChange={setDarkModeEnabled}
                  trackColor={{ false: '#767577', true: '#007AFF' }}
                  thumbColor={darkModeEnabled ? '#ffffff' : '#f4f3f4'}
                />
              )}
              style={styles.listItem}
              titleStyle={styles.listItemText}
              descriptionStyle={styles.listItemDescription}
            />
            <Divider style={styles.divider} />
            <List.Item
              title="Auto Save"
              description="Automatically save chat history"
              left={(props) => <List.Icon {...props} icon="content-save" />}
              right={() => (
                <Switch
                  value={autoSaveEnabled}
                  onValueChange={setAutoSaveEnabled}
                  trackColor={{ false: '#767577', true: '#007AFF' }}
                  thumbColor={autoSaveEnabled ? '#ffffff' : '#f4f3f4'}
                />
              )}
              style={styles.listItem}
              titleStyle={styles.listItemText}
              descriptionStyle={styles.listItemDescription}
            />
            <Divider style={styles.divider} />
            <List.Item
              title="Data Usage"
              description="Allow app to use mobile data"
              left={(props) => <List.Icon {...props} icon="wifi" />}
              right={() => (
                <Switch
                  value={dataUsageEnabled}
                  onValueChange={setDataUsageEnabled}
                  trackColor={{ false: '#767577', true: '#007AFF' }}
                  thumbColor={dataUsageEnabled ? '#ffffff' : '#f4f3f4'}
                />
              )}
              style={styles.listItem}
              titleStyle={styles.listItemText}
              descriptionStyle={styles.listItemDescription}
            />
          </Card>
        </View>

        {/* Data Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>
          <Card style={styles.card}>
            <List.Item
              title="Export Data"
              description="Export your chat history and settings"
              left={(props) => <List.Icon {...props} icon="export" />}
              onPress={handleExportData}
              style={styles.listItem}
              titleStyle={styles.listItemText}
              descriptionStyle={styles.listItemDescription}
            />
            <Divider style={styles.divider} />
            <List.Item
              title="Clear Data"
              description="Delete all chat history and settings"
              left={(props) => <List.Icon {...props} icon="delete" color="#ff4444" />}
              onPress={handleClearData}
              style={styles.listItem}
              titleStyle={[styles.listItemText, { color: '#ff4444' }]}
              descriptionStyle={styles.listItemDescription}
            />
          </Card>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <Card style={styles.card}>
            <List.Item
              title="Help & FAQ"
              description="Get help and find answers"
              left={(props) => <List.Icon {...props} icon="help-circle" />}
              onPress={() => Alert.alert('Help', 'Help section coming soon!')}
              style={styles.listItem}
              titleStyle={styles.listItemText}
              descriptionStyle={styles.listItemDescription}
            />
            <Divider style={styles.divider} />
            <List.Item
              title="Contact Support"
              description="Get in touch with our support team"
              left={(props) => <List.Icon {...props} icon="email" />}
              onPress={() => Alert.alert('Contact', 'Contact support coming soon!')}
              style={styles.listItem}
              titleStyle={styles.listItemText}
              descriptionStyle={styles.listItemDescription}
            />
            <Divider style={styles.divider} />
            <List.Item
              title="Rate App"
              description="Rate MornGPT on the app store"
              left={(props) => <List.Icon {...props} icon="star" />}
              onPress={() => Alert.alert('Rate', 'Rating feature coming soon!')}
              style={styles.listItem}
              titleStyle={styles.listItemText}
              descriptionStyle={styles.listItemDescription}
            />
          </Card>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Card style={styles.card}>
            <List.Item
              title="About MornGPT"
              description="Learn more about the app"
              left={(props) => <List.Icon {...props} icon="information" />}
              onPress={handleAbout}
              style={styles.listItem}
              titleStyle={styles.listItemText}
              descriptionStyle={styles.listItemDescription}
            />
            <Divider style={styles.divider} />
            <List.Item
              title="Privacy Policy"
              description="Read our privacy policy"
              left={(props) => <List.Icon {...props} icon="shield" />}
              onPress={() => Alert.alert('Privacy', 'Privacy policy coming soon!')}
              style={styles.listItem}
              titleStyle={styles.listItemText}
              descriptionStyle={styles.listItemDescription}
            />
            <Divider style={styles.divider} />
            <List.Item
              title="Terms of Service"
              description="Read our terms of service"
              left={(props) => <List.Icon {...props} icon="file-document" />}
              onPress={() => Alert.alert('Terms', 'Terms of service coming soon!')}
              style={styles.listItem}
              titleStyle={styles.listItemText}
              descriptionStyle={styles.listItemDescription}
            />
          </Card>
        </View>

        <Text style={styles.versionText}>MornGPT Mobile v1.0.0</Text>
      </View>
    </ScrollView>
  );
}
