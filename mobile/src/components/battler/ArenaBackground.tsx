/**
 * Luminous science-fantasy battle arena — View-only parallax for Expo Go.
 * World biomes (W1 Obsidian Astral Ruins / W2 Crystalline Spire Wastes /
 * W3+ Solar Forge Orbit) + 3 scrolling parallax layers (far / mid / near).
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ParallaxLayer } from '../../engine/BattlerEngine';
import { biomeForWorld, type BiomePalette } from '../../theme/biomes';
import { COLORS, FONTS } from '../../theme/colors';

const STAR_COUNT = 18;
const FAR_CHUNK_COUNT = 5;
const MID_CHUNK_COUNT = 4;
const NEAR_PLATE_COUNT = 6;

type ArenaBackgroundProps = {
  parallax: readonly ParallaxLayer[];
  width: number;
  height: number;
  /** currentSectorWorld — drives biome palette */
  sectorWorld: number;
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

function buildStars(
  width: number,
  height: number,
  tints: readonly string[],
): StarSpec[] {
  const skyH = height * 0.62;
  const stars: StarSpec[] = [];
  for (let i = 0; i < STAR_COUNT; i += 1) {
    const size = 1 + (i % 3);
    stars.push({
      key: `star-${i}`,
      left: (((i * 97) % 1000) / 1000) * width,
      top: (((i * 53) % 1000) / 1000) * skyH,
      size,
      opacity: 0.28 + (i % 5) * 0.1,
      color: tints[i % tints.length] ?? COLORS.celestial,
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

function AtmosphereBands({
  height,
  biome,
}: {
  height: number;
  biome: BiomePalette;
}): React.ReactElement {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          styles.voidWash,
          { backgroundColor: biome.voidWash },
        ]}
      />
      <View
        style={[
          styles.skyWash,
          { height: height * 0.38, backgroundColor: biome.skyWash },
        ]}
      />
      <View
        style={[
          styles.nebulaBlob,
          {
            top: height * 0.08,
            left: -40,
            width: '58%',
            height: height * 0.42,
            backgroundColor: biome.nebulaA,
          },
        ]}
      />
      <View
        style={[
          styles.nebulaBlob,
          {
            top: height * 0.02,
            right: -50,
            width: '52%',
            height: height * 0.36,
            backgroundColor: biome.nebulaB,
            borderRadius: 140,
          },
        ]}
      />
      <View
        style={[
          styles.nebulaBlob,
          {
            top: height * 0.42,
            left: '18%',
            width: '64%',
            height: height * 0.28,
            backgroundColor: biome.nebulaC,
            borderRadius: 100,
          },
        ]}
      />
      <View
        style={[
          styles.horizonGlow,
          {
            top: height * 0.58,
            height: height * 0.22,
            backgroundColor: biome.horizon,
          },
        ]}
      />
    </View>
  );
}

function Starfield({
  width,
  height,
  offset,
  biome,
}: {
  width: number;
  height: number;
  offset: number;
  biome: BiomePalette;
}): React.ReactElement {
  const stars = useMemo(
    () => buildStars(width, height, biome.starTints),
    [width, height, biome.starTints],
  );
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

/** Parallax layer 0 — far ridges / ruins / spires / forge silhouettes */
function FarRidges({
  width,
  height,
  offset,
  biome,
}: {
  width: number;
  height: number;
  offset: number;
  biome: BiomePalette;
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
        biome.accents,
      ),
    [period, biome.accents],
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
                  backgroundColor: biome.farFill,
                  borderLeftColor: biome.farEdge,
                },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/** Parallax layer 1 — mid platforms / crystal plates / forge gantries */
function MidTerrain({
  width,
  height,
  offset,
  biome,
}: {
  width: number;
  height: number;
  offset: number;
  biome: BiomePalette;
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
        biome.accents,
      ),
    [period, biome.accents],
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
                  backgroundColor: biome.midFill,
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

/** Parallax layer 2 — near ground plates */
function NearGround({
  width,
  height,
  offset,
  biome,
}: {
  width: number;
  height: number;
  offset: number;
  biome: BiomePalette;
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
        biome.accents,
      ),
    [period, biome.accents],
  );
  const shift = wrapOffset(offset, period);
  const groundTop = height * 0.78;
  const groundHeight = Math.max(24, height - groundTop);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          styles.groundPlane,
          {
            top: groundTop,
            height: groundHeight,
            backgroundColor: biome.groundPlane,
          },
        ]}
      />
      <View
        style={[
          styles.groundEdge,
          {
            top: groundTop,
            width,
            backgroundColor: biome.groundEdge,
          },
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
                  backgroundColor: biome.nearFill,
                },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function HorizonScan({
  width,
  height,
  biome,
}: {
  width: number;
  height: number;
  biome: BiomePalette;
}): React.ReactElement {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          styles.scanLine,
          {
            top: height * 0.34,
            width,
            opacity: 0.12,
            backgroundColor: biome.scan,
          },
        ]}
      />
      <View
        style={[
          styles.scanLine,
          {
            top: height * 0.72,
            width,
            opacity: 0.18,
            backgroundColor: biome.scan,
          },
        ]}
      />
      <Text style={[styles.biomeTag, { color: biome.scan }]} numberOfLines={1}>
        {biome.label}
      </Text>
    </View>
  );
}

export function ArenaBackground({
  parallax,
  width,
  height,
  sectorWorld,
}: ArenaBackgroundProps): React.ReactElement {
  const biome = useMemo(() => biomeForWorld(sectorWorld), [sectorWorld]);
  // Three parallax layers: far / mid / near (stars ride far offset slowly)
  const far = parallax[0]?.offset ?? 0;
  const mid = parallax[1]?.offset ?? far * 1.8;
  const near = parallax[2]?.offset ?? mid * 1.5;

  if (width <= 0 || height <= 0) {
    return <View />;
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <AtmosphereBands height={height} biome={biome} />
      <Starfield width={width} height={height} offset={far * 0.45} biome={biome} />
      <FarRidges width={width} height={height} offset={far} biome={biome} />
      <MidTerrain width={width} height={height} offset={mid} biome={biome} />
      <NearGround width={width} height={height} offset={near} biome={biome} />
      <HorizonScan width={width} height={height} biome={biome} />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollStrip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  voidWash: {
    ...StyleSheet.absoluteFill,
  },
  skyWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  nebulaBlob: {
    position: 'absolute',
    borderRadius: 120,
  },
  horizonGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  star: {
    position: 'absolute',
  },
  farRidge: {
    position: 'absolute',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRadius: 2,
  },
  midPlatform: {
    position: 'absolute',
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
  },
  groundEdge: {
    position: 'absolute',
    left: 0,
    height: 2,
  },
  nearPlate: {
    position: 'absolute',
    top: 2,
    borderTopWidth: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    height: StyleSheet.hairlineWidth,
  },
  biomeTag: {
    position: 'absolute',
    right: 10,
    bottom: 8,
    fontFamily: FONTS.mono,
    fontSize: 8,
    letterSpacing: 0.8,
    opacity: 0.55,
  },
});

export default ArenaBackground;
