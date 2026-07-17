import { createContext, useContext } from 'react';

export type PlanId = 'essentials' | 'signature' | 'grande';

export interface WizardApi {
  /** Open the get-started wizard, optionally preselecting a plan. */
  open: (plan?: PlanId) => void;
}

export const WizardContext = createContext<WizardApi>({ open: () => {} });

export function useWizard(): WizardApi {
  return useContext(WizardContext);
}
