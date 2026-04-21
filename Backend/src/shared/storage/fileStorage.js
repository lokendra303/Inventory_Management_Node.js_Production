const fs = require('fs');
const path = require('path');

function resolveUploadAbsolutePath(baseDir, relativeUploadPath) {
  const rel = String(relativeUploadPath || '').replace(/^\/+/, '');
  const candidates = [
    path.join(baseDir, '..', 'uploads', rel.replace(/^uploads[\\/]/, '')),
    path.join(baseDir, 'uploads', rel.replace(/^uploads[\\/]/, '')),
    path.join(baseDir, '..', rel),
    path.join(baseDir, rel),
  ];
  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

module.exports = {
  resolveUploadAbsolutePath,
};
