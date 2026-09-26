export interface TerminalMarketAdapter {
  readonly name: string;
  readonly simulated: boolean;
  sendLots(payload: unknown[]): Promise<'ACCEPTED'>;
}

// SIPI-Bénin publishes no public API yet: this adapter keeps the exact payload a real one would send.
export class SimulatedSipiAdapter implements TerminalMarketAdapter {
  readonly name = 'SIPI-Bénin marché terminal';
  readonly simulated = true;
  async sendLots(): Promise<'ACCEPTED'> {
    return 'ACCEPTED';
  }
}
