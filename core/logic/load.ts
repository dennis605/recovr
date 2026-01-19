// core/logic/load.ts

import { WorkoutSummary } from '../models/types';
import { calculateWorkoutLoad } from './recovery';

export type Sex = 'male' | 'female';

export interface HeartRateSample {
  startDate: string;
  endDate: string;
  value: number;
}

export interface ZoneConfig {
  z1: [number, number];
  z2: [number, number];
  z3: [number, number];
  z4: [number, number];
  z5: [number, number];
}

const DEFAULT_ZONE_PERCENTAGES: ZoneConfig = {
  z1: [0.5, 0.6],
  z2: [0.6, 0.7],
  z3: [0.7, 0.8],
  z4: [0.8, 0.9],
  z5: [0.9, 1.0],
};

const SPORT_MULTIPLIERS: Record<string, number> = {
  running: 1.0,
  cycling: 0.9,
  swimming: 0.95,
  strength: 0.7,
  hiit: 1.1,
  default: 0.85,
};

const DEFAULT_RPE = 5;

export interface WorkoutLoadInputs {
  zoneMinutes?: WorkoutSummary['zoneMinutes'];
  heartRateSamples?: HeartRateSample[];
  hrMax?: number;
  zoneConfig?: ZoneConfig;
  durationMinutes: number;
  avgHeartRate?: number;
  restingHeartRate?: number;
  sex?: Sex;
  rpe?: number;
  workoutType?: string;
}

export interface WorkoutLoadResult {
  loadScore: number;
  zoneMinutes: WorkoutSummary['zoneMinutes'];
  method: 'zones' | 'trimp' | 'rpe';
}

const createEmptyZones = (): WorkoutSummary['zoneMinutes'] => ({
  z1: 0,
  z2: 0,
  z3: 0,
  z4: 0,
  z5: 0,
});

const resolveZoneConfig = (hrMax: number, zoneConfig?: ZoneConfig): ZoneConfig => {
  if (zoneConfig) {
    return zoneConfig;
  }

  return {
    z1: [hrMax * DEFAULT_ZONE_PERCENTAGES.z1[0], hrMax * DEFAULT_ZONE_PERCENTAGES.z1[1]],
    z2: [hrMax * DEFAULT_ZONE_PERCENTAGES.z2[0], hrMax * DEFAULT_ZONE_PERCENTAGES.z2[1]],
    z3: [hrMax * DEFAULT_ZONE_PERCENTAGES.z3[0], hrMax * DEFAULT_ZONE_PERCENTAGES.z3[1]],
    z4: [hrMax * DEFAULT_ZONE_PERCENTAGES.z4[0], hrMax * DEFAULT_ZONE_PERCENTAGES.z4[1]],
    z5: [hrMax * DEFAULT_ZONE_PERCENTAGES.z5[0], hrMax * DEFAULT_ZONE_PERCENTAGES.z5[1]],
  };
};

const resolveSportMultiplier = (workoutType?: string): number => {
  if (!workoutType) return SPORT_MULTIPLIERS.default;
  const key = workoutType.toLowerCase();
  return SPORT_MULTIPLIERS[key] ?? SPORT_MULTIPLIERS.default;
};

export const calculateZoneMinutesFromSamples = (
  samples: HeartRateSample[],
  hrMax: number,
  zoneConfig?: ZoneConfig
): WorkoutSummary['zoneMinutes'] => {
  const zones = createEmptyZones();
  if (samples.length === 0 || hrMax <= 0) {
    return zones;
  }

  const resolvedZones = resolveZoneConfig(hrMax, zoneConfig);

  samples.forEach(sample => {
    const start = new Date(sample.startDate).getTime();
    const end = new Date(sample.endDate).getTime();
    const minutes = Math.max(0, (end - start) / (1000 * 60)) || 1;
    const bpm = sample.value;

    if (bpm >= resolvedZones.z5[0]) {
      zones.z5 += minutes;
    } else if (bpm >= resolvedZones.z4[0]) {
      zones.z4 += minutes;
    } else if (bpm >= resolvedZones.z3[0]) {
      zones.z3 += minutes;
    } else if (bpm >= resolvedZones.z2[0]) {
      zones.z2 += minutes;
    } else if (bpm >= resolvedZones.z1[0]) {
      zones.z1 += minutes;
    }
  });

  return zones;
};

export const calculateTrimpLoad = (
  durationMinutes: number,
  avgHeartRate: number,
  restingHeartRate: number,
  hrMax: number,
  sex: Sex = 'male'
): number => {
  const hrReserve = hrMax - restingHeartRate;
  if (durationMinutes <= 0 || hrReserve <= 0) {
    return 0;
  }

  const intensity = Math.min(
    1,
    Math.max(0, (avgHeartRate - restingHeartRate) / hrReserve)
  );

  const weighting =
    sex === 'female'
      ? 0.86 * Math.exp(1.67 * intensity)
      : 0.64 * Math.exp(1.92 * intensity);

  return durationMinutes * intensity * weighting;
};

export const calculateRpeLoad = (
  durationMinutes: number,
  rpe: number,
  workoutType?: string
): number => {
  if (durationMinutes <= 0) {
    return 0;
  }

  const multiplier = resolveSportMultiplier(workoutType);
  return durationMinutes * (rpe / 10) * 10 * multiplier;
};

export const calculateWorkoutLoadFromInputs = (inputs: WorkoutLoadInputs): WorkoutLoadResult => {
  const {
    zoneMinutes,
    heartRateSamples,
    hrMax,
    zoneConfig,
    durationMinutes,
    avgHeartRate,
    restingHeartRate,
    sex,
    rpe,
    workoutType,
  } = inputs;

  if (zoneMinutes) {
    return {
      loadScore: calculateWorkoutLoad(zoneMinutes),
      zoneMinutes,
      method: 'zones',
    };
  }

  if (heartRateSamples && hrMax) {
    const derivedZones = calculateZoneMinutesFromSamples(heartRateSamples, hrMax, zoneConfig);
    return {
      loadScore: calculateWorkoutLoad(derivedZones),
      zoneMinutes: derivedZones,
      method: 'zones',
    };
  }

  if (
    avgHeartRate !== undefined &&
    restingHeartRate !== undefined &&
    hrMax !== undefined
  ) {
    return {
      loadScore: calculateTrimpLoad(
        durationMinutes,
        avgHeartRate,
        restingHeartRate,
        hrMax,
        sex
      ),
      zoneMinutes: createEmptyZones(),
      method: 'trimp',
    };
  }

  const effectiveRpe = rpe ?? DEFAULT_RPE;
  return {
    loadScore: calculateRpeLoad(durationMinutes, effectiveRpe, workoutType),
    zoneMinutes: createEmptyZones(),
    method: 'rpe',
  };
};
