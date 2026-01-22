/**
 * Worker Client
 * Type-safe helper for communicating with the analysis Web Worker
 */

import {
  WorkerRequest,
  WorkerResponse,
  AnalysisInput,
  AnalysisResult,
} from "../types";

export type AnalysisWorkerClient = {
  analyze: (input: AnalysisInput) => Promise<AnalysisResult>;
  terminate: () => void;
};

/**
 * Create a new analysis worker client
 */
export function createAnalysisWorker(): AnalysisWorkerClient {
  let worker: Worker | null = null;
  const pendingRequests = new Map<
    string,
    {
      resolve: (result: AnalysisResult) => void;
      reject: (error: Error) => void;
    }
  >();

  // Initialize worker
  function getWorker(): Worker {
    if (!worker) {
      // Create worker using the webpack worker-loader syntax
      worker = new Worker(
        new URL("./analysis.worker.ts", import.meta.url)
      );

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const { type, payload, requestId } = event.data;
        const pending = pendingRequests.get(requestId);

        if (!pending) {
          console.warn(
            "[Worker Client] Received response for unknown request:",
            requestId
          );
          return;
        }

        pendingRequests.delete(requestId);

        if (type === "ANALYSIS_COMPLETE") {
          pending.resolve(payload as AnalysisResult);
        } else if (type === "ANALYSIS_ERROR") {
          pending.reject(new Error((payload as { error: string }).error));
        }
      };

      worker.onerror = (error) => {
        console.error("[Worker Client] Worker error:", error);
        // Reject all pending requests
        pendingRequests.forEach(({ reject }) => {
          reject(new Error("Worker error occurred"));
        });
        pendingRequests.clear();
      };
    }

    return worker;
  }

  /**
   * Generate unique request ID
   */
  function generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send analysis request to worker
   */
  function analyze(input: AnalysisInput): Promise<AnalysisResult> {
    return new Promise((resolve, reject) => {
      const requestId = generateRequestId();
      const w = getWorker();

      pendingRequests.set(requestId, { resolve, reject });

      const request: WorkerRequest = {
        type: "ANALYZE",
        payload: input,
        requestId,
      };

      w.postMessage(request);
    });
  }

  /**
   * Terminate the worker
   */
  function terminate(): void {
    if (worker) {
      worker.terminate();
      worker = null;
      pendingRequests.forEach(({ reject }) => {
        reject(new Error("Worker terminated"));
      });
      pendingRequests.clear();
    }
  }

  return {
    analyze,
    terminate,
  };
}
