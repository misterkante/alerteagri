import { toBeninPhone } from './phone';

describe('Beninese phone numbers (10 digits since 1 January 2025, ARCEP)', () => {
  it('turns every way people write a number into +229 01 XX XX XX XX', () => {
    for (const written of [
      '0197000001',
      '01 97 00 00 01',
      '01.97.00.00.01',
      '01-97-00-00-01',
      '+2290197000001',
      '+229 01 97 00 00 01',
      '002290197000001',
      '2290197000001',
      '(+229) 0197000001',
    ])
      expect(toBeninPhone(written)).toBe('+2290197000001');
  });

  it('accepts the former 8-digit numbers and adds 01, as the migration did', () => {
    expect(toBeninPhone('97000001')).toBe('+2290197000001');
    expect(toBeninPhone('97 00 00 01')).toBe('+2290197000001');
    expect(toBeninPhone('+22997000001')).toBe('+2290197000001');
    expect(toBeninPhone('0022997000001')).toBe('+2290197000001');
  });

  it('refuses what is not a Beninese mobile number', () => {
    for (const bad of [
      '',
      '1234',
      '0297000001',
      '019700000',
      '01970000011',
      '+33612345678',
      'abcdefghij',
      '+229 01 97 00 00 0x',
    ])
      expect(toBeninPhone(bad)).toBeNull();
  });

  it('ignores anything that is not a string', () => {
    expect(toBeninPhone(undefined)).toBeNull();
    expect(toBeninPhone(97000001)).toBeNull();
  });
});
