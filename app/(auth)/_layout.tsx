import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      {/* Potentially other auth screens like 'login', 'signup' */}
    </Stack>
  );
}
