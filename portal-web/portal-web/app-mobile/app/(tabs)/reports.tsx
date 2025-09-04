import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MobileReports } from '@/components/MobileReports';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ReportsTab() {
  return (
    <SafeAreaView style={styles.container}>
      <MobileReports />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
});