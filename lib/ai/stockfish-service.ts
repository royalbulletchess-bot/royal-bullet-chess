export function parseUCIMove(uci: string): {
  from: string;
  to: string;
  promotion?: string;
} {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : undefined,
  };
}

type StockfishState = 'idle' | 'initializing' | 'ready' | 'thinking' | 'disposed';

export class StockfishService {
  private worker: Worker | null = null;
  private state: StockfishState = 'idle';
  private messageHandler: ((data: string) => void) | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the engine. Loads the WASM worker from /public/stockfish/.
   * Safe to call multiple times — returns the same promise if already initializing.
   */
  async init(): Promise<void> {
    if (this.state === 'ready') return;
    if (this.state === 'disposed') throw new Error('Service disposed');
    if (this.initPromise) return this.initPromise;

    this.state = 'initializing';
    this.initPromise = new Promise<void>((resolve, reject) => {
      try {
        this.worker = new Worker('/stockfish/stockfish-18-lite-single.js');

        this.worker.onerror = (e) => {
          this.state = 'idle';
          this.initPromise = null;
          reject(new Error(`Stockfish worker error: ${e.message}`));
        };

        this.worker.onmessage = (e: MessageEvent) => {
          const data = typeof e.data === 'string' ? e.data : String(e.data);
          if (this.messageHandler) {
            this.messageHandler(data);
          }
        };

        // Wait for UCI initialization
        this.waitForResponse('uciok').then(() => {
          // Set hash size for lite version
          this.postCommand('setoption name Hash value 32');
          this.postCommand('isready');
          return this.waitForResponse('readyok');
        }).then(() => {
          this.state = 'ready';
          resolve();
        }).catch(reject);

        this.postCommand('uci');
      } catch (err) {
        this.state = 'idle';
        this.initPromise = null;
        reject(err);
      }
    });

    return this.initPromise;
  }

  /**
   * Configure engine difficulty via UCI Skill Level (0-20).
   */
  async setDifficulty(skillLevel: number): Promise<void> {
    if (this.state !== 'ready') throw new Error('Engine not ready');

    this.postCommand(`setoption name Skill Level value ${skillLevel}`);
    this.postCommand('isready');
    await this.waitForResponse('readyok');
  }

  /**
   * Get the best move for a given FEN position.
   * Returns UCI move string like "e2e4" or "e7e8q".
   */
  async getBestMove(fen: string, moveTimeMs: number): Promise<string> {
    if (this.state !== 'ready') throw new Error('Engine not ready');

    this.state = 'thinking';

    try {
      this.postCommand(`position fen ${fen}`);
      this.postCommand(`go movetime ${moveTimeMs}`);

      const response = await this.waitForResponse('bestmove');
      // Parse "bestmove e2e4 ponder d7d5" → "e2e4"
      const parts = response.split(' ');
      const bestMoveIndex = parts.indexOf('bestmove');
      const move = parts[bestMoveIndex + 1];

      if (!move || move === '(none)') {
        throw new Error('No best move found');
      }

      return move;
    } finally {
      // dispose() may have been called during the await, so check with cast
      if ((this.state as StockfishState) !== 'disposed') {
        this.state = 'ready';
      }
    }
  }

  /**
   * Terminate the Web Worker.
   */
  dispose(): void {
    this.state = 'disposed';
    this.messageHandler = null;
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  private postCommand(cmd: string): void {
    if (this.worker) {
      this.worker.postMessage(cmd);
    }
  }

  private waitForResponse(prefix: string, timeoutMs = 10000): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.messageHandler = null;
        reject(new Error(`Timeout waiting for ${prefix}`));
      }, timeoutMs);

      this.messageHandler = (data: string) => {
        if (data.startsWith(prefix)) {
          clearTimeout(timer);
          this.messageHandler = null;
          resolve(data);
        }
      };
    });
  }
}
