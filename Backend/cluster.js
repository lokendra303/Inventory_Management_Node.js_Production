const cluster = require('cluster');
const os = require('os');
const logger = require('./src/utils/logger');

const numCPUs = os.cpus().length;

if (cluster.isMaster) {
  logger.info(`Master process ${process.pid} starting`);
  logger.info(`Forking ${numCPUs} workers`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Handle worker exit
  cluster.on('exit', (worker, code, signal) => {
    logger.warn(`Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
    cluster.fork();
  });

  // Handle worker online
  cluster.on('online', (worker) => {
    logger.info(`Worker ${worker.process.pid} is online`);
  });

} else {
  // Worker process - start the server
  require('./src/server.js');
}
