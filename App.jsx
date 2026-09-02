import React from 'react';
import LegacyApp from './legacy/AppLegacy.jsx';
import HealthyStudentExperience from './features/HealthyStudentExperience.jsx';

// The original application is intentionally preserved as a compatibility layer.
// New student retention/economy/social systems live in dedicated modules so this
// entry point stays small and future extraction can continue incrementally.
export default function App() {
  return (
    <>
      <LegacyApp />
      <HealthyStudentExperience />
    </>
  );
}
