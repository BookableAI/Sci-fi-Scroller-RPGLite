/**
 * Luminous science-fantasy battle arena — View-only parallax for Expo Go.
 * Layers: nebula washes → starfield → far ridges → mid terrain → near plates.
 * Caps View counts; no shadows / Animated / Skia.
 */

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ParallaxLayer } from '../../engine/BattlerEngine';
import { COLORS } from '../../theme/colors';

const STAR_COUNT = 22;
const FAR_CHUNK_COUNT = 5;
const MID_CHUNK_COUNT = 4;
const NEAR_PLATE_COUNT = 6;

type ArenaBackgroundProps = {
  parallax: readonly ParallaxLayer[];
  width: number;
  height: number;
};

type StarSpec = {
  key: string;
  left: number;
  top: number;
  size: number;
  opacity: number;
  color: string;
};

type ChunkSpec = {
  key: string;
  left: number;
  width: number;
  height: number;
  accent: string;
};

function wrapOffset(offset: number, period: number): number {
  if (period <= 0) {
    return 0;
  }
  const mod = offset % period;
  return -(mod < 0 ? mod + period : mod);
}

function buildStars(width: number, height: number): StarSpec[] {
  const skyH = height * 0.62;
  const stars: StarSpec[] = [];
  for (let i = 0; i < STAR_COUNT; i += 1) {
    const size = 1 + (i % 3);
    const tint =
      i % 9 === 0 ? COLORS.cyan : i % 7 === 0 ? COLORS.violet : COLORS.celestial;
    stars.push({
      key: `star-${i}`,
      left: ((i * 97) % 1000) / 1000 * width,
      top: ((i * 53) % 1000) / 1000 * skyH,
      size,
      opacity: 0.28 + (i % 5) * 0.1,
      color: tint,
    });
  }
  return stars;
}

function buildChunks(
  count: number,
  period: number,
  minW: number,
  spanW: number,
  minH: number,
  spanH: number,
  prefix: string,
  accents: readonly string[],
): ChunkSpec[] {
  const chunks: ChunkSpec[] = [];
  for (let i = 0; i < count; i += 1) {
    chunks.push({
      key: `${prefix}-${i}`,
      left: (i / count) * period + ((i * 13) % 17),
      width: minW + ((i * 19) % spanW),
      height: minH + ((i * 11) % spanH),
      accent: accents[i % accents.length] ?? COLORS.borderGlow,
    });
  }
  return chunks;
}

function AtmosphereBands({ height }: { height: number }): React.ReactElement {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.skyWash, { height: height * 0.38 }]} />
      <View
        style={[
          styles.nebulaCyan,
          {
            top: height * 0.08,
            left: -40,
            width: '58%',
            height: height * 0.42,
          },
        ]}
      />
      <View
        style={[
          styles.nebulaViolet,
          {
            top: height * 0.02,
            right: -50,
            width: '52%',
            height: height * 0.36,
          },
        ]}
      />
      <View
        style={[
          styles.nebulaTeal,
          {
            top: height * 0.42,
            left: '18%',
            width: '64%',
            height: height * 0.28,
          },
        ]}
      />
      <View
        style={[
          styles.horizonGlow,
          { top: height * 0.58, height: height * 0.22 },
        ]}
      />
    </View>
  );
}

function Starfield({
  width,
  height,
  offset,
}: {
  width: number;
  height: number;
  offset: number;
}): React.ReactElement {
  const stars = useMemo(() => buildStars(width, height), [width, height]);
  const period = Math.max(1, width);
  const shift = wrapOffset(offset, period);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {[0, 1].map((copy) => (
        <View
          key={`star-copy-${copy}`}
          style={[styles.scrollStrip, { width: period, left: shift + copy * period }]}
        >
          {stars.map((star) => (
            <View
              key={`${star.key}-${copy}`}
              style={[
                styles.star,
                {
                  left: star.left,
                  top: star.top,
                  width: star.size,
                  height: star.size,
                  opacity: star.opacity,
                  backgroundColor: star.color,
                  borderRadius: star.size,
                },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function FarRidges({
  width,
  height,
  offset,
}: {
  width: number;
  height: number;
  offset: number;
}): React.ReactElement {
  const period = Math.max(1, Math.round(width * 1.15));
  const chunks = useMemo(
    () =>
      buildChunks(
        FAR_CHUNK_COUNT,
        period,
        48,
        70,
        18,
        36,
        'far',
        [COLORS.borderGlow, COLORS.violet, COLORS.teal],
      ),
    [period],
  );
  const shift = wrapOffset(offset, period);
  const baseTop = height * 0.52;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {[0, 1].map((copy) => (
        <View
          key={`far-copy-${copy}`}
          style={[styles.scrollStrip, { width: period, left: shift + copy * period }]}
        >
          {chunks.map((chunk) => (
            <View
              key={`${chunk.key}-${copy}`}
              style={[
                styles.farRidge,
                {
                  left: chunk.left,
                  top: baseTop - chunk.height,
                  width: chunk.width,
                  height: chunk.height,
                  borderTopColor: chunk.accent,
                },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function MidTerrain({
  width,
  height,
  offset,
}: {
  width: number;
  height: number;
  offset: number;
}): React.ReactElement {
  const period = Math.max(1, Math.round(width * 1.05));
  const chunks = useMemo(
    () =>
      buildChunks(
        MID_CHUNK_COUNT,
        period,
        56,
        90,
        14,
        28,
        'mid',
        [COLORS.cyan, COLORS.teal, COLORS.borderGlow],
      ),
    [period],
  );
  const shift = wrapOffset(offset, period);
  const baseTop = height * 0.68;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {[0, 1].map((copy) => (
        <View
          key={`mid-copy-${copy}`}
          style={[styles.scrollStrip, { width: period, left: shift + copy * period }]}
        >
          {chunks.map((chunk) => (
            <View
              key={`${chunk.key}-${copy}`}
              style={[
                styles.midPlatform,
                {
                  left: chunk.left,
                  top: baseTop - chunk.height,
                  width: chunk.width,
                  height: chunk.height,
                  borderColor: chunk.accent,
                },
              ]}
            >
              <View
                style={[
                  styles.midInset,
                  { borderColor: chunk.accent, opacity: 0.55 },
                ]}
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function NearGround({
  width,
  height,
  offset,
}: {
  width: number;
  height: number;
  offset: number;
}): React.ReactElement {
  const period = Math.max(1, Math.round(width * 0.9));
  const plates = useMemo(
    () =>
      buildChunks(
        NEAR_PLATE_COUNT,
        period,
        40,
        48,
        6,
        10,
        'near',
        [COLORS.cyan, COLORS.teal, COLORS.violet],
      ),
    [period],
  );
  const shift = wrapOffset(offset, period);
  const groundTop = height * 0.78;
  const groundHeight = Math.max(24, height - groundTop);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          styles.groundPlane,
          { top: groundTop, height: groundHeight },
        ]}
      />
      <View
        style={[
          styles.groundEdge,
          { top: groundTop, width },
        ]}
      />
      {[0, 1].map((copy) => (
        <View
          key={`near-copy-${copy}`}
          style={[
            styles.scrollStrip,
            {
              width: period,
              left: shift + copy * period,
              top: groundTop + 4,
              height: 18,
            },
          ]}
        >
          {plates.map((plate) => (
            <View
              key={`${plate.key}-${copy}`}
              style={[
                styles.nearPlate,
                {
                  left: plate.left,
                  width: plate.width,
                  height: plate.height,
                  borderColor: plate.accent,
                },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function HorizonScan({ width, height }: { width: number; height: number }): React.ReactElement {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          styles.scanLine,
          { top: height * 0.34, width, opacity: 0.12 },
        ]}
      />
      <View
        style={[
          styles.scanLine,
          {
            top: height * 0.72,
            width,
            opacity: 0.18,
            backgroundColor: COLORS.teal,
          },
        ]}
      />
    </View>
  );
}

export function ArenaBackground({
  parallax,
  width,
  height,
}: ArenaBackgroundProps): React.ReactElement {
  const layer0 = parallax[0]?.offset ?? 0;
  const layer1 = parallax[1]?.offset ?? layer0 * 1.6;
  const layer2 = parallax[2]?.offset ?? layer1 * 1.5;
  const layer3 = parallax[3]?.offset ?? layer2 * 1.4;

  if (width <= 0 || height <= 0) {
    return <View />;
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <AtmosphereBands height={height} />
      <Starfield width={width} height={height} offset={layer0} />
      <FarRidges width={width} height={height} offset={layer1} />
      <MidTerrain width={width} height={height} offset={layer2} />
      <NearGround width={width} height={height} offset={layer3} />
      <HorizonScan width={width} height={height} />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollStrip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  skyWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(18, 36, 72, 0.45)',
  },
  nebulaCyan: {
    position: 'absolute',
    backgroundColor: 'rgba(56, 189, 248, 0.10)',
    borderRadius: 120,
  },
  nebulaViolet: {
    position: 'absolute',
    backgroundColor: 'rgba(167, 139, 250, 0.09)',
    borderRadius: 140,
  },
  nebulaTeal: {
    position: 'absolute',
    backgroundColor: 'rgba(45, 212, 191, 0.07)',
    borderRadius: 100,
  },
  horizonGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(45, 212, 191, 0.08)',
  },
  star: {
    position: 'absolute',
  },
  farRidge: {
    position: 'absolute',
    backgroundColor: 'rgba(20, 28, 46, 0.85)',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(61, 79, 120, 0.55)',
    borderRadius: 2,
  },
  midPlatform: {
    position: 'absolute',
    backgroundColor: 'rgba(26, 36, 56, 0.92)',
    borderWidth: 1,
    borderRadius: 3,
    overflow: 'hidden',
  },
  midInset: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: 3,
    bottom: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 2,
  },
  groundPlane: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10, 16, 28, 0.94)',
  },
  groundEdge: {
    position: 'absolute',
    left: 0,
    height: 2,
    backgroundColor: 'rgba(45, 212, 191, 0.55)',
  },
  nearPlate: {
    position: 'absolute',
    top: 2,
    borderTopWidth: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: 'rgba(30, 44, 68, 0.75)',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.cyan,
  },
});

export default ArenaBackground;
