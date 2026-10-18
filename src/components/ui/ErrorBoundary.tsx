import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Something went wrong.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Mori Pay render error:', error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, message: '' });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <AppText variant="title3" align="center">
          Something went wrong
        </AppText>
        <AppText variant="bodySmall" color="#5b6575" align="center" style={styles.message}>
          {this.state.message || 'Mori Pay could not display this screen.'}
        </AppText>
        <Pressable onPress={this.reset} style={styles.button}>
          <AppText variant="bodySmall" color="#ffffff" style={styles.buttonText}>
            Try again
          </AppText>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#f7f8fa',
  },
  centered: {
    textAlign: 'center',
  },
  message: {
    maxWidth: 360,
  },
  button: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#0e7367',
  },
  buttonText: {
    fontWeight: '600',
  },
});
