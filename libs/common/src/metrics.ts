type Metric = {
  name: string;
  ts?: string;
  [k: string]: any;
};

export function metric(name: string, fields: Record<string, any> = {}) {
  const payload: Metric = { name, ts: new Date().toISOString(), ...fields };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ type: 'metric', ...payload }));
}

