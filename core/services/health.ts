// core/services/health.ts
import { ExpoHealthKit } from 'expo-health-kit/build/runtime';
import { HealthKitDataType } from 'expo-health-kit/build/types';
import { Platform } from 'react-native';

export type HealthInputOptions = {
  startDate: string;
  endDate?: string;
};

export type HealthValue = {
  startDate: string;
  endDate: string;
  value?: number;
  unit?: string;
  sourceName?: string;
  metadata?: Record<string, unknown>;
  uuid?: string;
  activityName?: string;
};

const healthKit = new ExpoHealthKit();
let isConfigured = false;

const selectedDataTypes: HealthKitDataType[] = [
  HealthKitDataType.WORKOUT,
  HealthKitDataType.HEART_RATE,
  HealthKitDataType.RESTING_HEART_RATE,
  HealthKitDataType.HEART_RATE_VARIABILITY_SDNN,
  HealthKitDataType.SLEEP_ANALYSIS,
];

const ensureConfigured = async () => {
  if (isConfigured) return;
  await healthKit.configure({
    selectedDataTypes,
    exportFormat: 'json',
  });
  isConfigured = true;
};

const toDateRange = (options: HealthInputOptions) => {
  const startDate = new Date(options.startDate);
  const endDate = options.endDate ? new Date(options.endDate) : new Date();
  return { startDate, endDate };
};

const normalizeSample = (sample: any): HealthValue => ({
  startDate: sample.startDate,
  endDate: sample.endDate ?? sample.startDate,
  value: typeof sample.value === 'number' ? sample.value : undefined,
  unit: sample.unit,
  sourceName: sample.sourceName,
  metadata: sample.metadata,
  uuid: sample.uuid,
});

const normalizeWorkoutSample = (sample: any, index: number): HealthValue => ({
  ...normalizeSample(sample),
  uuid: sample.uuid ?? sample.metadata?.uuid ?? `workout-${index}-${sample.startDate ?? ''}`,
  activityName:
    sample.metadata?.workoutActivityType ??
    sample.metadata?.activityName ??
    sample.activityName ??
    'Workout',
});

/**
 * Initializes HealthKit by requesting permissions.
 * @throws An error if permissions are not granted or the platform is not iOS.
 */
export const initializeHealthKit = (): Promise<boolean> => {
  return new Promise(async (resolve, reject) => {
    if (Platform.OS !== 'ios') {
      return reject(new Error('HealthKit is only available on iOS.'));
    }
    try {
      await ensureConfigured();
      const isAvailable = await healthKit.isHealthKitAvailable();
      if (!isAvailable) {
        return reject(new Error('HealthKit is not available on this device.'));
      }
      const authResult = await healthKit.requestAuthorization(selectedDataTypes);
      if (!authResult.success) {
        return reject(new Error('Failed to initialize HealthKit permissions.'));
      }
      resolve(true);
    } catch (error) {
      console.error('Error initializing HealthKit:', error);
      reject(new Error('Failed to initialize HealthKit.'));
    }
  });
};

/**
 * Fetches workouts within a specified date range.
 * Placeholder function. Implementation to follow.
 * @param options - The date range for the query.
 */
export const fetchWorkouts = (options: HealthInputOptions): Promise<HealthValue[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureConfigured();
      const { startDate, endDate } = toDateRange(options);
      const results = await healthKit.queryHealthData(
        HealthKitDataType.WORKOUT,
        startDate,
        endDate
      );
      resolve(results.map((sample: any, index: number) => normalizeWorkoutSample(sample, index)));
    } catch (error) {
      reject(error);
    }
  });
};


/**
 * Fetches Resting Heart Rate samples within a specified date range.
 * Placeholder function. Implementation to follow.
 * @param options - The date range for the query.
 */
export const fetchRestingHeartRate = (options: HealthInputOptions): Promise<HealthValue[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureConfigured();
      const { startDate, endDate } = toDateRange(options);
      const results = await healthKit.queryHealthData(
        HealthKitDataType.RESTING_HEART_RATE,
        startDate,
        endDate,
        { ascending: true }
      );
      resolve(results.map((sample: any) => normalizeSample(sample)));
    } catch (error) {
      reject(new Error(`Error fetching RHR samples: ${error}`));
    }
  });
};

/**
 * Fetches Heart Rate Variability (SDNN) samples within a specified date range.
 * Placeholder function. Implementation to follow.
 * @param options - The date range for the query.
 */
export const fetchHrv = (options: HealthInputOptions): Promise<HealthValue[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureConfigured();
      const { startDate, endDate } = toDateRange(options);
      const results = await healthKit.queryHealthData(
        HealthKitDataType.HEART_RATE_VARIABILITY_SDNN,
        startDate,
        endDate,
        { ascending: true }
      );
      resolve(results.map((sample: any) => normalizeSample(sample)));
    } catch (error) {
      reject(new Error(`Error fetching HRV samples: ${error}`));
    }
  });
};

/**
 * Fetches Sleep Analysis samples within a specified date range.
 * Placeholder function. Implementation to follow.
 * @param options - The date range for the query.
 */
export const fetchSleep = (options: HealthInputOptions): Promise<HealthValue[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureConfigured();
      const { startDate, endDate } = toDateRange(options);
      const results = await healthKit.queryHealthData(
        HealthKitDataType.SLEEP_ANALYSIS,
        startDate,
        endDate,
        { ascending: true }
      );
      resolve(results.map((sample: any) => normalizeSample(sample)));
    } catch (error) {
      reject(new Error(`Error fetching sleep samples: ${error}`));
    }
  });
};

/**
 * Fetches Heart Rate samples within a specified date range.
 * @param options - The date range for the query.
 */
export const fetchHeartRateSamples = (options: HealthInputOptions): Promise<HealthValue[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureConfigured();
      const { startDate, endDate } = toDateRange(options);
      const results = await healthKit.queryHealthData(
        HealthKitDataType.HEART_RATE,
        startDate,
        endDate,
        { ascending: true }
      );
      resolve(results.map((sample: any) => normalizeSample(sample)));
    } catch (error) {
      reject(new Error(`Error fetching heart rate samples: ${error}`));
    }
  });
};
