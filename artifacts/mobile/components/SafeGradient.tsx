import React from "react";
import { View, ViewProps } from "react-native";

type Props = ViewProps & {
  colors?: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  children?: React.ReactNode;
};

export const Gradient: React.FC<Props> = ({ colors, style, children }) => {
  const bg = Array.isArray(colors) && colors.length > 0 ? colors[0] : undefined;
  return (
    <View style={[style as any, bg ? { backgroundColor: bg } : undefined]}>
      {children}
    </View>
  );
};

export default Gradient;
