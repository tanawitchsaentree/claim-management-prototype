import { CAUSE_SCHEMAS } from './cause-schemas';

export interface DevScenario {
  key: string;
  label: string;
  causeOfLoss: string[];
  typeOfDamage: string[];
  description: string;
  eventCausedBy?: Record<string, string[]>;
}

export const SCENARIOS: Record<string, DevScenario> = Object.entries(CAUSE_SCHEMAS).reduce(
  (acc, [key, schema]) => {
    acc[key] = {
      key,
      label: schema.causeLabel,
      causeOfLoss: [key],
      typeOfDamage: ['material-damage'],
      description: `Auto-filled ${schema.causeLabel.toLowerCase()} scenario for testing`,
      eventCausedBy: schema.causedByOptions?.length
        ? { [key]: [schema.causedByOptions[0].value] }
        : undefined,
    };
    return acc;
  },
  {} as Record<string, DevScenario>,
);

export const SCENARIO_LIST: DevScenario[] = Object.values(SCENARIOS);
