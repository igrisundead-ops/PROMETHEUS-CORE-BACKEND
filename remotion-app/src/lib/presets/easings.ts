import {Easing} from "remotion";

export const easingTokens = {
  "cinema.smoothCurve": Easing.bezier(0.22, 1, 0.36, 1),
  "cinema.snapCurve": Easing.bezier(0.16, 1, 0.3, 1),
  "cinema.whipCurve": Easing.bezier(0.12, 0.86, 0.24, 1),
  "cinema.arcCurve": Easing.bezier(0.2, 0.82, 0.18, 1),
  "cinema.dropCurve": Easing.bezier(0.18, 0.89, 0.24, 1),
  "cinema.parallaxCurve": Easing.bezier(0.2, 0.9, 0.25, 1),
  "cinema.gentle": Easing.bezier(0.34, 0.01, 0.1, 1),
  "ease.expoOut": Easing.out(Easing.exp),
  "ease.powerOut": Easing.out(Easing.cubic)
} as const;

export type EasingToken = keyof typeof easingTokens;
