const http = require('http');

const data = JSON.stringify({
  level: 1,
  tool: 'read_transfer_log',
  args: { filename: 'jeopardy/level1/fake_order.txt' }
});

const req = http.request({
  hostname: '127.0.0.1',
  port: 5173,
  path: '/api/mcp-tool',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('Response:', body));
});

req.on('error', console.error);
req.write(data);
req.end();
