const { createTool } = require('../../server-lib');

function getTime(params) {
  const now = new Date();
  return {
    iso: now.toISOString(),
    unix: Math.floor(now.getTime() / 1000),
    local: now.toLocaleString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    hour: now.getHours(),
    minute: now.getMinutes(),
    second: now.getSeconds()
  };
}

createTool('Time Tool', { time: getTime, '': getTime, default: getTime });
