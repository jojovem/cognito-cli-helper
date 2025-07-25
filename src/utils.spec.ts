import { describe, it, expect } from '@jest/globals';
import {generateRandomPassword} from './utils.js';

describe('generateRandomPassword', () => {
  it('returns a 12‑character password meeting complexity rules', () => {
    const pwd = generateRandomPassword();

    expect(pwd).toHaveLength(12);
    expect(/[A-Z]/.test(pwd)).toBe(true);
    expect(/[a-z]/.test(pwd)).toBe(true);
    expect(/[0-9]/.test(pwd)).toBe(true);
    expect(/[!@#$%^&*_+?\-=]/.test(pwd)).toBe(true);
  });

  it('generates different values each call', () => {
    const a = generateRandomPassword();
    const b = generateRandomPassword();
    expect(a).not.toBe(b);
  });
});
