/**
 * Utilitaires audio pour la conversion entre formats Twilio et OpenAI Realtime
 *
 * Note : OpenAI Realtime API supporte nativement g711_ulaw en input/output,
 * donc aucune conversion n'est necessaire quand les deux sont configures en g711_ulaw.
 * Ces utilitaires restent disponibles si un format PCM16 est requis a l'avenir.
 */

// Table de decompression mu-law -> Linear PCM16
const MULAW_DECODE_TABLE = new Int16Array(256);
(function buildMulawTable() {
  for (let i = 0; i < 256; i++) {
    let mu = ~i & 0xff;
    const sign = (mu & 0x80) ? -1 : 1;
    mu = mu & 0x7f;
    const exponent = (mu >> 4) & 0x07;
    const mantissa = mu & 0x0f;
    let sample = ((mantissa << 1) + 33) << (exponent + 2);
    sample = (sample - 0x84) * sign;
    MULAW_DECODE_TABLE[i] = sample;
  }
})();

/**
 * Convertit un buffer G.711 mu-law en PCM16 linear
 * @param {Buffer} mulawBuffer
 * @returns {Buffer} PCM16 buffer (little-endian)
 */
export function mulawToLinear16(mulawBuffer) {
  const pcm = Buffer.alloc(mulawBuffer.length * 2);
  for (let i = 0; i < mulawBuffer.length; i++) {
    const sample = MULAW_DECODE_TABLE[mulawBuffer[i]];
    pcm.writeInt16LE(sample, i * 2);
  }
  return pcm;
}

// Table de compression Linear PCM16 -> mu-law
const MULAW_BIAS = 0x84;
const MULAW_CLIP = 32635;

/**
 * Convertit un buffer PCM16 linear en G.711 mu-law
 * @param {Buffer} pcm16Buffer - PCM16 little-endian
 * @returns {Buffer} G.711 mu-law buffer
 */
export function linear16ToMulaw(pcm16Buffer) {
  const mulaw = Buffer.alloc(pcm16Buffer.length / 2);
  for (let i = 0; i < mulaw.length; i++) {
    let sample = pcm16Buffer.readInt16LE(i * 2);
    const sign = (sample < 0) ? 0x80 : 0;
    if (sample < 0) sample = -sample;
    if (sample > MULAW_CLIP) sample = MULAW_CLIP;
    sample += MULAW_BIAS;

    let exponent = 7;
    const expMask = 0x4000;
    for (; exponent > 0; exponent--) {
      if (sample & expMask) break;
      sample <<= 1;
    }

    const mantissa = (sample >> 10) & 0x0f;
    const byte = ~(sign | (exponent << 4) | mantissa) & 0xff;
    mulaw[i] = byte;
  }
  return mulaw;
}

/**
 * Decode base64 en Buffer
 * @param {string} b64
 * @returns {Buffer}
 */
export function base64Decode(b64) {
  return Buffer.from(b64, 'base64');
}

/**
 * Encode Buffer en base64
 * @param {Buffer} buffer
 * @returns {string}
 */
export function base64Encode(buffer) {
  return buffer.toString('base64');
}

export default {
  mulawToLinear16,
  linear16ToMulaw,
  base64Decode,
  base64Encode,
};
