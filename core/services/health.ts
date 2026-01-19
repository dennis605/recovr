// core/services/health.ts
// eslint-disable-next-line import/no-unresolved
import AppleHealthKit, {
  HealthValue,
  HealthKitPermissions,
  HealthInputOptions,
} from 'expo-health-kit';
import { Platform } from 'react-native';

// Define the permissions we will request from HealthKit.
const permissions: HealthKitPermissions = {
  permissions: {
    read: [
      // Workouts
      AppleHealthKit.Constants.Permissions.Workout,
      // Vitals
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.RestingHeartRate,
      AppleHealthKit.Constants.Permissions.HeartRateVariability,
      // Sleep
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
      // Characteristics (for fallbacks)
      AppleHealthKit.Constants.Permissions.DateOfBirth,
    ],
    write: [], // We are not writing any data in the MVP
  },
};

/**
 * Initializes HealthKit by requesting permissions.
 * @throws An error if permissions are not granted or the platform is not iOS.
 */
export const initializeHealthKit = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (Platform.OS !== 'ios') {
      return reject(new Error('HealthKit is only available on iOS.'));
    }

    AppleHealthKit.initHealthKit(permissions, (error: string, results: boolean) => {
      if (error) {
        console.error('Error initializing HealthKit:', error);
        return reject(new Error('Failed to initialize HealthKit.'));
      }
      console.log('HealthKit initialized successfully.');
      resolve(results);
    });
  });
};

/**
 * Fetches workouts within a specified date range.
 * Placeholder function. Implementation to follow.
 * @param options - The date range for the query.
 */
export const fetchWorkouts = (options: HealthInputOptions): Promise<HealthValue[]> => {
    return new Promise((resolve, reject) => {
        AppleHealthKit.getSamples(
            {
                startDate: options.startDate,
                endDate: options.endDate,
                type: 'Workout'
            },
            (err: string, results: HealthValue[]) => {
                if (err) {
                    return reject(err);
                }
                resolve(results);
            }
        );
    });
};


/**
 * Fetches Resting Heart Rate samples within a specified date range.
 * Placeholder function. Implementation to follow.
 * @param options - The date range for the query.
 */
export const fetchRestingHeartRate = (options: HealthInputOptions): Promise<HealthValue[]> => {
  return new Promise((resolve, reject) => {
    // Note: This is a simplified example. You might need more complex queries.
    AppleHealthKit.getRestingHeartRateSamples(options, (err: string, results: HealthValue[]) => {
      if (err) {
        return reject(new Error(`Error fetching RHR samples: ${err}`));
      }
      resolve(results);
    });
  });
};

/**
 * Fetches Heart Rate Variability (SDNN) samples within a specified date range.
 * Placeholder function. Implementation to follow.
 * @param options - The date range for the query.
 */
export const fetchHrv = (options: HealthInputOptions): Promise<HealthValue[]> => {
    return new Promise((resolve, reject) => {
        AppleHealthKit.getHeartRateVariabilitySamples(options, (err: string, results: HealthValue[]) => {
            if(err){
                return reject(new Error(`Error fetching HRV samples: ${err}`));
            }
            resolve(results);
        })
    });
};

/**
 * Fetches Sleep Analysis samples within a specified date range.
 * Placeholder function. Implementation to follow.
 * @param options - The date range for the query.
 */
export const fetchSleep = (options: HealthInputOptions): Promise<HealthValue[]> => {
    return new Promise((resolve, reject) => {
        AppleHealthKit.getSleepSamples(options, (err: string, results: HealthValue[]) => {
            if(err){
                return reject(new Error(`Error fetching sleep samples: ${err}`));
            }
            resolve(results);
        });
    });
};

// We will also need functions to fetch HR samples within a workout.
// This is more complex and will be added later.
