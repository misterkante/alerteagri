import { fillMessage } from './messages';

describe('alert messages', () => {
  it('writes decimals and thousands the French way', () => {
    expect(fillMessage('Chaleur {m} °C', { m: 42.3 })).toBe('Chaleur 42,3 °C');
    expect(fillMessage('{n} kg', { n: 12500 })).toBe('12\u202f500 kg');
  });

  it('fills every occurrence and leaves unknown fields untouched', () => {
    expect(fillMessage('{a} puis {a}, {b}', { a: 'pluie' })).toBe(
      'pluie puis pluie, {b}',
    );
  });
});
