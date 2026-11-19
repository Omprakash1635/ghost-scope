// Scaffold smoke test — confirms Vitest is wired up correctly.
import { describe, it, expect } from 'vitest';

describe('scaffold', () => {
  it('vitest is running', () => {
    expect(1 + 1).toBe(2);
  });
});
