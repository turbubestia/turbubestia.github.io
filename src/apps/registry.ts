import type { ComponentType } from 'react';
import { SightReadingApp } from './sight-reading/SightReadingApp';

export interface AppEntry {
  id: string;
  title: string;
  description: string;
  icon: string;
  component: ComponentType;
}

/**
 * The app launcher is driven by this registry.
 * To add a new app: create its component under src/apps/<id>/ and add an entry here.
 */
export const apps: AppEntry[] = [
  {
    id: 'sight-reading',
    title: 'Sight Reading',
    description: 'Practice reading notes on a MIDI keyboard',
    icon: '🎼',
    component: SightReadingApp,
  },
];
