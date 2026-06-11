const axios = require('axios');
const logger = require('../utils/logger');

function normalizeIp(raw) {
  if (!raw) return null;
  let ip = String(raw).trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip.includes(',')) ip = ip.split(',')[0].trim();
  return ip || null;
}

function isPrivateOrLocalIp(ip) {
  if (!ip) return true;
  if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('169.254.')) return true;
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function buildLabel({ city, region, country }) {
  return [city, region, country].filter(Boolean).join(', ') || null;
}

async function lookupIp(rawIp) {
  const ip = normalizeIp(rawIp);
  if (!ip) return null;

  if (isPrivateOrLocalIp(ip)) {
    return {
      city: null,
      region: null,
      country: null,
      country_code: null,
      label: 'Local network',
      is_local: true,
    };
  }

  try {
    const { data } = await axios.get(`http://ip-api.com/json/${encodeURIComponent(ip)}`, {
      timeout: 3500,
      params: {
        fields: 'status,message,country,countryCode,regionName,city',
      },
    });

    if (!data || data.status !== 'success') {
      logger.debug('IP geolocation lookup returned no result', { ip, message: data?.message });
      return null;
    }

    const city = data.city || null;
    const region = data.regionName || null;
    const country = data.country || null;

    return {
      city,
      region,
      country,
      country_code: data.countryCode || null,
      label: buildLabel({ city, region, country }),
      is_local: false,
    };
  } catch (error) {
    logger.warn('IP geolocation lookup failed', { ip, error: error.message });
    return null;
  }
}

module.exports = {
  normalizeIp,
  isPrivateOrLocalIp,
  lookupIp,
  buildLabel,
};
