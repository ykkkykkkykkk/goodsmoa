const { createLogger, format, transports } = require('winston');
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';

const logger = createLogger({
  level: isProd ? 'info' : 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    isProd
      ? format.json()
      : format.combine(format.colorize(), format.printf(({ timestamp, level, message, stack }) =>
          `${timestamp} [${level}] ${stack || message}`
        ))
  ),
  transports: [
    new transports.Console(),
    ...(isProd ? [
      new transports.File({ filename: path.join(__dirname, 'logs', 'error.log'), level: 'error', maxsize: 5 * 1024 * 1024, maxFiles: 5 }),
      new transports.File({ filename: path.join(__dirname, 'logs', 'combined.log'), maxsize: 10 * 1024 * 1024, maxFiles: 5 }),
    ] : []),
  ],
});

module.exports = logger;
