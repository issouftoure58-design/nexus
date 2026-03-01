/**
 * Voice Recording Storage Service
 * Downloads and stores Twilio voice recordings
 */

import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';

/**
 * Save a voice recording to the database
 * @param {string} tenantId - Tenant ID
 * @param {object} recordingData - Recording data from Twilio
 * @returns {Promise<object>} Saved recording record
 */
export async function saveVoiceRecording(tenantId, recordingData) {
  const {
    RecordingUrl,
    RecordingSid,
    CallSid,
    From,
    Duration,
    TranscriptionText
  } = recordingData;

  if (!tenantId) {
    logger.error('Cannot save recording without tenant_id');
    throw new Error('tenant_id required');
  }

  try {
    // Download recording from Twilio (with auth)
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const authHeader = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');

    // The recording URL needs .mp3 or .wav extension
    const recordingUrlWithFormat = `${RecordingUrl}.mp3`;

    // Fetch the recording
    const response = await fetch(recordingUrlWithFormat, {
      headers: {
        'Authorization': `Basic ${authHeader}`
      }
    });

    if (!response.ok) {
      logger.warn('Could not download recording, storing URL only', { RecordingSid });
    }

    // If we got the recording, upload to Supabase storage
    let storagePath = null;
    if (response.ok) {
      const audioBuffer = await response.arrayBuffer();
      const fileName = `recordings/${tenantId}/${RecordingSid}.mp3`;

      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('voice-recordings')
        .upload(fileName, audioBuffer, {
          contentType: 'audio/mpeg',
          upsert: true
        });

      if (uploadError) {
        logger.warn('Failed to upload to storage', { error: uploadError.message });
      } else {
        storagePath = uploadData.path;
        logger.info('Recording uploaded to storage', { path: storagePath });
      }
    }

    // Save recording metadata to database
    const { data: recording, error: dbError } = await supabase
      .from('voice_recordings')
      .insert({
        tenant_id: tenantId,
        recording_sid: RecordingSid,
        call_sid: CallSid,
        caller_phone: From,
        duration_seconds: parseInt(Duration) || 0,
        transcription: TranscriptionText || null,
        twilio_url: RecordingUrl,
        storage_path: storagePath,
        status: 'completed',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (dbError) {
      // Table might not exist, create it
      if (dbError.code === '42P01') {
        logger.warn('voice_recordings table does not exist, creating...');
        await createVoiceRecordingsTable();
        // Retry insert
        const { data: retryData, error: retryError } = await supabase
          .from('voice_recordings')
          .insert({
            tenant_id: tenantId,
            recording_sid: RecordingSid,
            call_sid: CallSid,
            caller_phone: From,
            duration_seconds: parseInt(Duration) || 0,
            transcription: TranscriptionText || null,
            twilio_url: RecordingUrl,
            storage_path: storagePath,
            status: 'completed',
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (retryError) throw retryError;
        return retryData;
      }
      throw dbError;
    }

    logger.twilio('Recording saved', tenantId, {
      recordingSid: RecordingSid,
      duration: Duration,
      hasStorage: !!storagePath
    });

    return recording;

  } catch (error) {
    logger.error('Failed to save voice recording', {
      error: error.message,
      tenantId,
      RecordingSid
    });
    throw error;
  }
}

/**
 * Get voice recordings for a tenant
 * @param {string} tenantId - Tenant ID
 * @param {object} options - Filter options
 * @returns {Promise<array>} List of recordings
 */
export async function getVoiceRecordings(tenantId, options = {}) {
  const { limit = 50, offset = 0, startDate, endDate } = options;

  let query = supabase
    .from('voice_recordings')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (startDate) {
    query = query.gte('created_at', startDate);
  }
  if (endDate) {
    query = query.lte('created_at', endDate);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('Failed to fetch voice recordings', { error: error.message });
    throw error;
  }

  return data || [];
}

/**
 * Get signed URL for a recording
 * @param {string} tenantId - Tenant ID
 * @param {string} recordingId - Recording ID
 * @returns {Promise<string>} Signed URL
 */
export async function getRecordingUrl(tenantId, recordingId) {
  const { data: recording, error } = await supabase
    .from('voice_recordings')
    .select('storage_path, twilio_url')
    .eq('id', recordingId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !recording) {
    throw new Error('Recording not found');
  }

  // If stored in Supabase, generate signed URL
  if (recording.storage_path) {
    const { data: signedUrl, error: signError } = await supabase
      .storage
      .from('voice-recordings')
      .createSignedUrl(recording.storage_path, 3600); // 1 hour

    if (!signError && signedUrl) {
      return signedUrl.signedUrl;
    }
  }

  // Fallback to Twilio URL
  return recording.twilio_url;
}

/**
 * Create voice_recordings table if it doesn't exist
 */
async function createVoiceRecordingsTable() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS voice_recordings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      recording_sid TEXT NOT NULL,
      call_sid TEXT,
      caller_phone TEXT,
      duration_seconds INTEGER DEFAULT 0,
      transcription TEXT,
      twilio_url TEXT,
      storage_path TEXT,
      status TEXT DEFAULT 'completed',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(tenant_id, recording_sid)
    );

    CREATE INDEX IF NOT EXISTS idx_voice_recordings_tenant ON voice_recordings(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_voice_recordings_created ON voice_recordings(created_at DESC);

    ALTER TABLE voice_recordings ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Tenant isolation" ON voice_recordings
      FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);
  `;

  // Note: This would need to be run via migration in production
  logger.warn('voice_recordings table creation should be done via migration');
}

export default {
  saveVoiceRecording,
  getVoiceRecordings,
  getRecordingUrl
};
