import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  View,
} from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { feedback, neutral } from '@/theme/palette';

const VIEWBOX_SIZE = 40;
const CENTER = VIEWBOX_SIZE / 2;
const INNER_RADIUS = 10;
const BASE_OUTER_RADIUS = 15;
const SEGMENT_GAP = 30;

const SEGMENT_COLOURS = [
  feedback.electricBlue,
  feedback.cyan,
  feedback.electricBlue,
  neutral[0],
  feedback.cyan,
  feedback.navy,
  feedback.electricBlue,
  feedback.cyan,
  neutral[0],
  feedback.electricBlue,
  feedback.cyan,
  feedback.navy,
];

function pointOnCircle(radius: number, angle: number) {
  const radians = (angle * Math.PI) / 180;

  return {
    x: CENTER + radius * Math.cos(radians),
    y: CENTER + radius * Math.sin(radians),
  };
}

export function SegmentedSpinner({
  size = 24,
  label = 'Inachakata muamala',
}: {
  size?: number;
  label?: string;
}) {
  const [rotation] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [rotation]);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={{ width: size, height: size }}
    >
      <Animated.View
        style={{
          width: size,
          height: size,
          transform: [{ rotate }],
        }}
      >
        <Svg
          width={size}
          height={size}
          viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        >
          {SEGMENT_COLOURS.map((colour, index) => {
            const angle = -90 + index * SEGMENT_GAP;
            const inner = pointOnCircle(INNER_RADIUS, angle);
            const outer = pointOnCircle(
              BASE_OUTER_RADIUS + (index % 3) * 1.5,
              angle,
            );

            return (
              <Line
                key={index}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke={colour}
                strokeWidth={Math.max(1.5, size * 0.09)}
                strokeLinecap="round"
              />
            );
          })}
        </Svg>
      </Animated.View>
    </View>
  );
}
