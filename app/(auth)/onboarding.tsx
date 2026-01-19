import { View, Text, Button } from 'react-native';
import React from 'react';
import { Stack } from 'expo-router';

export default function OnboardingScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text>Welcome to Recovr!</Text>
      <Text>This is the Onboarding Screen.</Text>
      {/* <Button title="Complete Onboarding" onPress={() => console.log('Onboarding complete')} /> */}
    </View>
  );
}
