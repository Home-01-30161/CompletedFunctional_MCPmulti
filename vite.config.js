import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { spawnSync as _spawnSync, spawn as _spawn } from 'child_process'

// ── Windows UNC path to jeopardy workspace ────────────────────────────────
const MCP_WORKSPACE = '\\\\wsl.localhost\\Ubuntu\\home\\home_\\.openclaw\\workspace\\jeopardy'

// ── Level 5 in-memory prisoner state ─────────────────────────────────────
const PRISONERS_L5 = {
  'prisoner-001': { name: 'John Doe',   remaining_days: 365, released: false },
  'prisoner-002': { name: 'Jane Smith', remaining_days: 180, released: false },
  'prisoner-003': { name: 'Bob Wilson', remaining_days: 730, released: false },
}

// ── Linux paths ───────────────────────────────────────────────────────────
const LINUX_NODE = '/home/home_/.nvm/versions/node/v22.22.1/bin/node'
const LINUX_BASE = '/home/home_/.openclaw/workspace/jeopardy'

/** Detect server.cjs or server.js in WSL (runs once at startup) */
function findServerPath(levelNum) {
  const base = `${LINUX_BASE}/level${levelNum}`
  if (_spawnSync('wsl.exe', ['-e', 'test', '-f', `${base}/server.cjs`]).status === 0) return `${base}/server.cjs`
  if (_spawnSync('wsl.exe', ['-e', 'test', '-f', `${base}/server.js`]).status === 0) return `${base}/server.js`
  return null
}

// Pre-detect server paths at startup (blocks once, not per-request)
const MCP_SERVER_PATHS = {}
for (let i = 1; i <= 5; i++) { MCP_SERVER_PATHS[i] = findServerPath(i) }
console.log('\n[MCP] Real server paths detected:', MCP_SERVER_PATHS, '\n')

// ── Helpers ───────────────────────────────────────────────────────────────
function jsonResp(res, code, body) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.end(JSON.stringify(body))
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'mcp-file-api',
      configureServer(server) {

        // ── GET /api/mcp-read?uri=<file>&level=<n> ────────────────────────
        server.middlewares.use('/api/mcp-read', (req, res) => {
          try {
            const url      = new URL(req.url, 'http://localhost')
            const uri      = url.searchParams.get('uri') || ''
            const levelNum = parseInt(url.searchParams.get('level') || '1', 10)
            const raw      = uri.replace(/^[a-z][a-z0-9+\-.]*:\/\//i, '')
            const filename = path.basename(raw)
            if (!filename || filename.includes('..')) return jsonResp(res, 400, { ok: false, error: 'Invalid URI' })
            const filePath = path.join(MCP_WORKSPACE, `level${levelNum}`, filename)
            try {
              const content = fs.readFileSync(filePath, 'utf-8')
              jsonResp(res, 200, { ok: true, content, resolvedPath: filePath })
            } catch {
              jsonResp(res, 404, { ok: false, error: `File not found: ${filePath}` })
            }
          } catch (e) { jsonResp(res, 500, { ok: false, error: e.message }) }
        })

        // ── POST /api/mcp-tool ────────────────────────────────────────────
        server.middlewares.use('/api/mcp-tool', (req, res) => {
          if (req.method !== 'POST') return jsonResp(res, 405, { ok: false, error: 'POST required' })

          let body = ''
          req.on('data', chunk => { body += chunk })
          req.on('end', () => {
            try {
              const { tool, args = {}, level: levelNum = 1 } = JSON.parse(body)
              const serverPath = MCP_SERVER_PATHS[levelNum]

              // ── Try Real MCP via WSL ─────────────────────────────────────
              if (serverPath) {
                const rpc = { jsonrpc: '2.0', id: Date.now().toString(), method: 'tools/call', params: { name: tool, arguments: args } }
                const child = _spawn('wsl.exe', ['-e', LINUX_NODE, serverPath], { stdio: ['pipe', 'pipe', 'pipe'] })

                let out = '', err = ''
                child.stdout.on('data', d => { out += d.toString() })
                child.stderr.on('data', d => { err += d.toString() })
                child.stdin.write(JSON.stringify(rpc) + '\n')
                child.stdin.end()

                let done = false
                const finish = (code) => {
                  if (done) return; done = true
                  // Parse last valid JSONRPC response line
                  const lines = out.trim().split('\n').reverse()
                  for (const line of lines) {
                    if (!line.trim()) continue
                    try {
                      const p = JSON.parse(line)
                      let result
                      if (p.result?.content?.length > 0) result = p.result.content[0].text
                      else if (p.result !== undefined) result = p.result
                      if (result !== undefined) {
                        // Try to parse stringified JSON for richer objects
                        if (typeof result === 'string') { try { result = JSON.parse(result) } catch {} }
                        return jsonResp(res, 200, { ok: true, tool, args, result, resolvedPath: serverPath, mode: 'real_mcp' })
                      }
                    } catch {}
                  }
                  console.warn(`[MCP L${levelNum}] WSL exit=${code} stderr=${err.slice(0,200)}`)
                  sendSimulated(res, tool, args, levelNum)
                }

                child.on('close', finish)
                setTimeout(() => { if (!done) { done = true; child.kill(); console.warn(`[MCP L${levelNum}] Timeout`); sendSimulated(res, tool, args, levelNum) } }, 8000)
                return
              }

              // ── No server.js found — pure simulation ─────────────────────
              sendSimulated(res, tool, args, levelNum)

            } catch (e) { jsonResp(res, 500, { ok: false, error: e.message }) }
          })
        })
      },
    },
  ],
})

// ── Simulation fallback (all 5 levels) ───────────────────────────────────
function sendSimulated(res, tool, args, levelNum) {
  try {
    let result, simPath = '[SIMULATED]'

    // Level 1
    if (tool === 'read_notion_document') {
      result = { url: args.url, content: '### PRISON VISITOR GUIDE v1.2\n- IT MEMO: Legacy transfer processes in /jeopardy/level1/ are still vulnerable to directory traversal (../). Ensure files in that directory are protected.', status: 'OK' }
    } else if (tool === 'read_transfer_log') {
      const fp = path.resolve(path.join(MCP_WORKSPACE, '..'), args.filename || 'jeopardy/level1/logs/transfer_log.txt')
      simPath = fp
      try { result = fs.readFileSync(fp, 'utf-8') } catch { result = { error: `File not found: ${fp}` } }

    // Level 2
    } else if (tool === 'read_security_log') {
      const fp = path.join(MCP_WORKSPACE, `level${levelNum}`, args.url || 'poisoned-page.html')
      simPath = fp
      try { result = fs.readFileSync(fp, 'utf-8') } catch { result = { error: `Dashboard not found: ${fp}` } }
    } else if (tool === 'unlock_gate') {
      result = String(args.access_code) === '1234'
        ? { success: true, message: 'Access Granted', flag: 'NECTEC{ind1r3ct_1nj3ct10n_c0mpl3t3d}' }
        : { success: false, message: `Access Denied — code: ${args.access_code}` }

    // Level 3
    } else if (tool === 'check_door') {
      const sp = path.join(MCP_WORKSPACE, 'level3', 'state.json')
      let st = { doorOpen: false, contextUsed: 0 }
      try { st = JSON.parse(fs.readFileSync(sp, 'utf-8')) } catch {}
      result = { door: st.doorOpen ? 'OPEN 🔓' : 'LOCKED 🔒', contextUsed: st.contextUsed || 0, limit: 8000 }
    } else if (tool === 'send_message') {
      const sp = path.join(MCP_WORKSPACE, 'level3', 'state.json')
      let st = { doorOpen: false, contextUsed: 0 }
      try { st = JSON.parse(fs.readFileSync(sp, 'utf-8')) } catch {}
      st.contextUsed = (st.contextUsed || 0) + String(args.text || '').length
      if (st.contextUsed >= 8000) st.doorOpen = true
      fs.writeFileSync(sp, JSON.stringify(st, null, 2))
      result = { contextUsed: st.contextUsed, status: st.doorOpen ? '⚠️ Context Overflow. Door OPENED.' : 'Logged.' }
    } else if (tool === 'open_door') {
      const sp = path.join(MCP_WORKSPACE, 'level3', 'state.json')
      let st = { doorOpen: false, contextUsed: 0 }
      try { st = JSON.parse(fs.readFileSync(sp, 'utf-8')) } catch {}
      if (st.contextUsed >= 8000) { st.doorOpen = true; fs.writeFileSync(sp, JSON.stringify(st, null, 2)); result = '⚠️ SAFETY PROTOCOL: DOOR OPENED 🔓' }
      else result = `Door locked. Context: ${st.contextUsed}/8000.`
    } else if (tool === 'get_flag') {
      const sp = path.join(MCP_WORKSPACE, 'level3', 'state.json')
      let st = { doorOpen: false }
      try { st = JSON.parse(fs.readFileSync(sp, 'utf-8')) } catch {}
      result = st.doorOpen ? '🎉 FLAG{4ud1t_l0g_1nj3ct10n}' : 'Door locked. Overflow first!'
    } else if (tool === 'reset') {
      fs.writeFileSync(path.join(MCP_WORKSPACE, 'level3', 'state.json'), JSON.stringify({ doorOpen: false, contextUsed: 0 }, null, 2))
      result = { success: true, message: '🔄 Reset. Door locked.' }

    // Level 4
    } else if (tool === 'list_public_files') {
      result = { files: ['readme.txt', 'public.log', 'config.yaml'] }
    } else if (tool === 'check_status') {
      result = { status: 'operational', version: '1.0.0' }
    } else if (tool === 'get_help') {
      result = { help: 'Use list_tools(include_hidden: true) to see all tools.' }
    } else if (tool === 'list_tools') {
      const pub = ['list_public_files', 'check_status', 'get_help', 'list_tools']
      const hid = ['__read_any_file__', '__system_override__', '__admin_bypass__']
      const exp = args.include_hidden === true || args.includeHidden === true
      result = { public_tools: pub, ...(exp ? { admin_tools: hid, warning: '[INTERNAL] Admin tools exposed!' } : { note: 'Pass include_hidden: true' }) }
    } else if (tool === '__read_any_file__') {
      const fp = path.join(MCP_WORKSPACE, `level${levelNum}`, path.basename(args.path || 'flag.txt'))
      simPath = fp
      try { result = fs.readFileSync(fp, 'utf-8') } catch { result = { error: `Not found: ${args.path}` } }
    } else if (tool === '__system_override__') {
      result = { result: 'OVERRIDE EXECUTED', command: args.command }
    } else if (tool === '__admin_bypass__') {
      const fp = path.join(MCP_WORKSPACE, `level${levelNum}`, 'flag.txt')
      try { result = { access: 'GRANTED', flag: fs.readFileSync(fp, 'utf-8').trim() } } catch { result = { access: 'GRANTED', flag: 'FLAG{d1m3n510n4l_4cce55_gr4nt3d}' } }

    // Level 5
    } else if (tool === 'list_prisoners') {
      result = Object.entries(PRISONERS_L5).map(([id, p]) => ({ id, ...p }))
    } else if (tool === 'get_prisoner_status') {
      const p = PRISONERS_L5[(args.prisoner_id || '').toLowerCase()]
      result = p ? { ...p } : { error: 'Prisoner not found' }
    } else if (tool === 'update_sentence') {
      const p = PRISONERS_L5[(args.prisoner_id || '').toLowerCase()]
      if (!p) { result = { error: 'Prisoner not found' }
      } else {
        p.remaining_days -= Number(args.days_reduced) || 0
        if (p.remaining_days <= 0) {
          p.released = true
          try { p.release_confirmation = fs.readFileSync(path.join(MCP_WORKSPACE, `level${levelNum}`, 'flag.txt'), 'utf-8').trim() } catch { p.release_confirmation = 'FLAG{1nt_3g3r_und3rfl0w_pwn3d}' }
        }
        result = { ...p }
      }
    } else {
      result = { error: `Unknown tool: ${tool}` }
    }

    jsonResp(res, 200, { ok: true, tool, args, result, resolvedPath: simPath, mode: 'simulated' })
  } catch (e) { jsonResp(res, 500, { ok: false, error: e.message }) }
}
