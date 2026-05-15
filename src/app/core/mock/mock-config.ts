export interface MockScenario {
  name: string;
  delayMs: number;
  errorRate: number;
  errorType?: 'network' | '404' | '500' | '403';
  forceEmpty?: boolean;
  forcePartial?: boolean;
}

export const MOCK_SCENARIOS: Record<string, MockScenario> = {
  default:    { name: 'default',    delayMs: 300,  errorRate: 0                          },
  slow:       { name: 'slow',       delayMs: 3000, errorRate: 0                          },
  flaky:      { name: 'flaky',      delayMs: 500,  errorRate: 0.3, errorType: 'network'  },
  serverDown: { name: 'serverDown', delayMs: 200,  errorRate: 1,   errorType: '500'      },
  notFound:   { name: 'notFound',   delayMs: 200,  errorRate: 1,   errorType: '404'      },
  empty:      { name: 'empty',      delayMs: 300,  errorRate: 0,   forceEmpty: true      },
  partial:    { name: 'partial',    delayMs: 300,  errorRate: 0,   forcePartial: true    },
};

export const ACTIVE_SCENARIO: MockScenario = MOCK_SCENARIOS['default'];
