import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../src/client/index.js';

test('浏览器插件以 settings 命名空间注册 keyed slot', () => {
  const registrations: Array<Record<string, unknown>> = [];
  const ctx = {
    slots: {
      inject: (_name: string, provide: () => unknown) => {
        provide();
      },
      register: (options: Record<string, unknown>) => {
        registrations.push(options);
        return () => {};
      },
    },
    locale: { register: () => () => {} },
    effect: (effect: () => unknown) => {
      effect();
    },
  };

  apply(ctx as never);

  const settingsCard = registrations.find(entry => entry.name === 'settings.plugin.item');
  assert.equal(settingsCard?.key, 'dsh-passwords');
});
