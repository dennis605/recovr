// core/services/health.ts
import { HealthKitDataType } from 'expo-health-kit/build/types';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export type HealthInputOptions = {
  startDate: string;
  endDate?: string;
  limit?: number;
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

export type HealthKitDebugStatus = {
  moduleAvailable: boolean;
  isAvailable?: boolean;
  authorizationStatus?: Record<string, string>;
  error?: string;
};

const healthKitModule = requireOptionalNativeModule<any>('ExpoHealthKit');

const selectedDataTypes: HealthKitDataType[] = [
  HealthKitDataType.WORKOUT,
  HealthKitDataType.HEART_RATE,
  HealthKitDataType.RESTING_HEART_RATE,
  HealthKitDataType.HEART_RATE_VARIABILITY_SDNN,
  HealthKitDataType.SLEEP_ANALYSIS,
];

export const isHealthKitModuleAvailable = () => {
  return Platform.OS === 'ios' && !!healthKitModule;
};

const ensureNativeModuleAvailable = () => {
  if (Platform.OS !== 'ios') {
    throw new Error('HealthKit ist nur auf iOS verfügbar.');
  }
  if (!healthKitModule) {
    throw new Error(
      'Das ExpoHealthKit-Modul ist nicht verfügbar. Füge das expo-health-kit Plugin hinzu und nutze einen Development Build (Expo Go unterstützt HealthKit nicht).'
    );
  }
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
    if (!isHealthKitModuleAvailable()) {
      return resolve(false);
    }
    try {
      ensureNativeModuleAvailable();
      const isAvailable = await healthKitModule.isHealthKitAvailable();
      if (!isAvailable) {
        return reject(new Error('HealthKit ist auf diesem Gerät nicht verfügbar.'));
      }
      const authResult = await healthKitModule.requestAuthorization(selectedDataTypes);
      const authSuccess =
        typeof authResult === 'object' && authResult !== null && 'success' in authResult
          ? Boolean(authResult.success)
          : Boolean(authResult);
      if (!authSuccess) {
        return reject(new Error('HealthKit-Berechtigungen konnten nicht initialisiert werden.'));
      }
      resolve(true);
    } catch (error) {
      console.error('Error initializing HealthKit:', error);
      reject(new Error('HealthKit konnte nicht initialisiert werden.'));
    }
  });
};

export const getHealthKitStatus = async (): Promise<HealthKitDebugStatus> => {
  if (!isHealthKitModuleAvailable()) {
    return { moduleAvailable: false };
  }
  try {
    ensureNativeModuleAvailable();
    const isAvailable = await healthKitModule.isHealthKitAvailable();
    if (!isAvailable) {
      return { moduleAvailable: true, isAvailable: false };
    }
    const authorizationStatus = await healthKitModule.getAuthorizationStatus(selectedDataTypes);
    return { moduleAvailable: true, isAvailable, authorizationStatus };
  } catch (error: any) {
    return {
      moduleAvailable: true,
      error: error?.message ?? String(error),
    };
  }
};

/**
 * Fetches workouts within a specified date range.
 * Placeholder function. Implementation to follow.
 * @param options - The date range for the query.
 */
export const fetchWorkouts = (options: HealthInputOptions): Promise<HealthValue[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      ensureNativeModuleAvailable();
      const { startDate, endDate } = toDateRange(options);
      const results = await healthKitModule.queryHealthData(
        HealthKitDataType.WORKOUT,
        startDate.toISOString(),
        endDate.toISOString(),
        { ascending: false, limit: 200 }
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
      ensureNativeModuleAvailable();
      const { startDate, endDate } = toDateRange(options);
      const results = await healthKitModule.queryHealthData(
        HealthKitDataType.RESTING_HEART_RATE,
        startDate.toISOString(),
        endDate.toISOString(),
        { ascending: true, limit: 500 }
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
      ensureNativeModuleAvailable();
      const { startDate, endDate } = toDateRange(options);
      const results = await healthKitModule.queryHealthData(
        HealthKitDataType.HEART_RATE_VARIABILITY_SDNN,
        startDate.toISOString(),
        endDate.toISOString(),
        { ascending: true, limit: 200 }
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
      ensureNativeModuleAvailable();
      const { startDate, endDate } = toDateRange(options);
      const results = await healthKitModule.queryHealthData(
        HealthKitDataType.SLEEP_ANALYSIS,
        startDate.toISOString(),
        endDate.toISOString(),
        { ascending: true, limit: 500 }
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
      ensureNativeModuleAvailable();
      const { startDate, endDate } = toDateRange(options);
      const limit = options.limit ?? 500;
      const results = await healthKitModule.queryHealthData(
        HealthKitDataType.HEART_RATE,
        startDate.toISOString(),
        endDate.toISOString(),
        { ascending: true, limit }
      );
      resolve(results.map((sample: any) => normalizeSample(sample)));
    } catch (error) {
      reject(new Error(`Error fetching heart rate samples: ${error}`));
    }
  });
};
