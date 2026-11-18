/** React Native / Expo provide these globals; declare for strict tsc without DOM lib. */
declare function requestAnimationFrame(
  callback: (time: number) => void,
): number;
declare function cancelAnimationFrame(handle: number): void;
