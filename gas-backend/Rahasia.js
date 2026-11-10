// ========================================================================
// Rahasia.js: Akses Satu Pintu Script Properties & Keamanan Kriptografi
// Standar: 13 Aturan Wajib gas-rahasia-script-properties (R1 - R13)
// ========================================================================

const PROPS = PropertiesService.getScriptProperties();
let _PROP_MEMO = null;

// Akses Satu Pintu (R2) dengan Memoization
function prop_(key, def) {
  if (!_PROP_MEMO) _PROP_MEMO = PROPS.getProperties();
  const v = _PROP_MEMO[key];
  return v === undefined || v === null || v === '' ? (def === undefined ? '' : def) : v;
}

function setProp_(key, val) {
  PROPS.setProperty(key, String(val));
  if (_PROP_MEMO) _PROP_MEMO[key] = String(val);
}

function setProps_(obj) {
  PROPS.setProperties(obj);
  if (_PROP_MEMO) Object.keys(obj).forEach(k => { _PROP_MEMO[k] = String(obj[k]); });
}

function delProp_(key) {
  PROPS.deleteProperty(key);
  if (_PROP_MEMO) delete _PROP_MEMO[key];
}

// Masking Rahasia untuk Tampilan UI (ABCD••••xyz)
function maskSecret_(val) {
  if (!val || typeof val !== 'string') return '';
  if (val.length <= 6) return '••••••';
  return val.slice(0, 4) + '••••••' + val.slice(-3);
}

// Perbandingan Waktu-Konstan (Anti Timing Attack)
function samaAman_(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Pembangkit Kunci Acak Kriptografis
function acakAman_(n) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  while (s.length < n) {
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid())
      .forEach(b => { if (s.length < n) s += chars[(b & 0xff) % chars.length]; });
  }
  return s;
}

// Inisialisasi Rahasia Awal Otomatis (R3 & R10)
function initSecuritySecrets_() {
  if (!prop_('SESSION_SECRET')) {
    setProp_('SESSION_SECRET', acakAman_(32));
    console.log('[Security] SESSION_SECRET baru berhasil dibuat otomatis.');
  }
}
