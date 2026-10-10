import { unstable_getMaterialSymbolSourceAsync, type AndroidSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import {
  Image,
  Platform,
  Text,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type AndroidMaterialIconProps = {
  name: AndroidSymbol;
  size: number;
  color: string;
  style?: StyleProp<ViewStyle>;
};

const sources = new Map<string, Promise<ImageSourcePropType | null>>();

function getSource(name: AndroidSymbol, size: number, color: string) {
  const key = `${name}:${size}:${color}`;
  let source = sources.get(key);

  if (!source) {
    source = unstable_getMaterialSymbolSourceAsync(name, size, color).then((result) => {
      if (!result) {
        throw new Error(`Material Symbol "${name}" did not produce an image`);
      }
      return result;
    }).catch((error: unknown) => {
      console.error(`Could not render Android Material Symbol "${name}"`, error);
      sources.delete(key);
      return null;
    });
    sources.set(key, source);
  }

  return source;
}

export function AndroidMaterialIcon({ name, size, color, style }: AndroidMaterialIconProps) {
  const key = `${name}:${size}:${color}`;
  const [loaded, setLoaded] = useState<{ key: string; source: ImageSourcePropType | null } | null>(null);
  const source = loaded?.key === key ? loaded.source : null;

  useEffect(() => {
    let active = true;

    if (Platform.OS === 'android') {
      void getSource(name, size, color).then((result) => {
        if (active) setLoaded({ key, source: result });
      });
    }

    return () => {
      active = false;
    };
  }, [key, name, size, color]);

  if (Platform.OS !== 'android') return null;
  if (!source) {
    return (
      <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
        <Text accessibilityLabel={`Icon unavailable: ${name}`} style={{ color, fontSize: size * 0.75, lineHeight: size }}>
          !
        </Text>
      </View>
    );
  }

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Image source={source} resizeMode="contain" style={{ width: size, height: size }} />
    </View>
  );
}
