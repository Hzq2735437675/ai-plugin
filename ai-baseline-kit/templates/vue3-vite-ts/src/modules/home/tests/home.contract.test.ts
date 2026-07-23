import { describe, expect, it } from 'vitest';
import { homeModule } from '../manifest';

describe('home module contract', () => {
  it('通过统一 manifest 暴露 home 模块', () => {
    expect(homeModule.name).toBe('home');
  });
});
