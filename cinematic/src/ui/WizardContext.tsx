import { createContext, useContext } from 'react';

export type PlanId = 'basic' | 'standard' | 'premium';

export interface WizardApi {
  /** Open the get-started wizard, optionally preselecting a plan and guest range. */
  open: (plan?: PlanId, range?: number) => void;
}

export const WizardContext = createContext<WizardApi>({ open: () => {} });

export function useWizard(): WizardApi {
  return useContext(WizardContext);
}
