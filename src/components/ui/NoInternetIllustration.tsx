import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export function NoInternetIllustration({ size = 160 }: { size?: number }) {
  return (
    <View style={styles.container}>
      <Svg width={size} height={size} viewBox="0 0 160 160" fill="none">
        <Circle cx="80" cy="80" r="72" fill="#eaf7f5" />
        <Circle cx="80" cy="80" r="52" fill="#ffffff" stroke="#cdebe6" strokeWidth="2" />
        <Path
          d="M52 82c0-15.464 12.536-28 28-28s28 12.536 28 28"
          stroke="#0e7367"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <Path
          d="M64 82c0-8.837 7.163-16 16-16s16 7.163 16 16"
          stroke="#34a596"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <Circle cx="80" cy="82" r="6" fill="#0e7367" />
        <Path
          d="M44 118l72-72"
          stroke="#a32a21"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <Rect x="58" y="104" width="44" height="8" rx="4" fill="#d3d8df" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
