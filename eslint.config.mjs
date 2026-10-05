import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // eslint-plugin-react-hooks v7 (bundled with eslint-config-next 16) flags
      // the standard "reset loading/error state, then kick off the async fetch"
      // pattern used throughout app/*.tsx — the same shape React's own docs use
      // for data fetching in an effect. Not a bug here.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];

export default config;
