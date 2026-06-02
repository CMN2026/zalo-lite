import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSettings } from "../contexts/settings";

export default function ModalScreen() {
  const { language } = useSettings();
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">
        {language === "en" ? "This is a modal" : "Đây là một màn hình modal"}
      </ThemedText>
      <Link href="/" dismissTo style={styles.link}>
        <ThemedText type="link">
          {language === "en" ? "Go to home screen" : "Về màn hình chính"}
        </ThemedText>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
