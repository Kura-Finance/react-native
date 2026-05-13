/**
 * Asset HTTP client + Phase 3 decryption pipeline.
 *
 * Endpoints:
 *   GET /api/assets/history/encrypted?days=1..365
 *   GET /api/assets/dates
 */

import { requestJson } from '../client';
import { decryptEnvelopeRows } from '../../crypto/envelope';
import {
  aggregateAssetHistory,
  type AggregationOptions,
  type AssetHistoryPoint,
  type DecryptedAssetSnapshot,
} from './aggregation';
import {
  assetSnapshotPayloadSchema,
  encryptedAssetHistorySchema,
  recordDatesResponseSchema,
  type AssetSnapshotPayload,
  type EncryptedAssetSnapshotRowV1,
  type RecordDatesResponseV1,
} from './schemas';
import Logger from '../../../shared/utils/Logger';

const apiName = 'AssetApi';

/**
 * Fetch + decrypt every snapshot row. Decryption failures are silently
 * dropped (with a warn log) so the chart still renders the surviving days.
 */
export async function fetchDecryptedAssetSnapshots(
  days: number = 30,
): Promise<DecryptedAssetSnapshot[]> {
  const clampedDays = Math.max(1, Math.min(365, Math.floor(days)));
  const raw = await requestJson<unknown>(
    `/api/assets/history/encrypted?days=${clampedDays}`,
    { method: 'GET', apiName },
  );
  const envelope = encryptedAssetHistorySchema.parse(raw);

  const { decrypted, failed } = await decryptEnvelopeRows<
    AssetSnapshotPayload,
    EncryptedAssetSnapshotRowV1
  >(envelope.payloadKeys, envelope.snapshots);

  if (failed.length > 0) {
    Logger.warn(apiName, 'Some asset snapshot rows failed to decrypt', {
      failed: failed.length,
      total: envelope.snapshots.length,
    });
  }

  const out: DecryptedAssetSnapshot[] = [];
  for (const item of decrypted) {
    try {
      const payload = assetSnapshotPayloadSchema.parse(item.payload);
      out.push({
        id: item.row.id,
        metric: item.row.metric,
        recordedAt: item.row.recordedAt,
        value: payload.value,
      });
    } catch (error) {
      Logger.warn(apiName, 'Snapshot payload failed schema validation', {
        id: item.row.id,
        metric: item.row.metric,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return out;
}

/**
 * One-shot read: snapshots fetched, decrypted, then aggregated into one
 * point per UTC day per the four base metrics.
 */
export async function fetchAssetHistory(
  days: number = 30,
  options: AggregationOptions = {},
): Promise<AssetHistoryPoint[]> {
  const snapshots = await fetchDecryptedAssetSnapshots(days);
  return aggregateAssetHistory(snapshots, options);
}

/**
 * `GET /api/assets/dates` — metadata only. No decryption needed.
 */
export async function fetchAssetRecordDates(): Promise<RecordDatesResponseV1> {
  const raw = await requestJson<unknown>('/api/assets/dates', {
    method: 'GET',
    apiName,
  });
  return recordDatesResponseSchema.parse(raw);
}
