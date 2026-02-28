const express = require('express')
const fs = require('fs')
const path = require('path')

const app = express()
app.use(express.json())

const DATA_FILE = path.join(__dirname, 'data.json')

let store = {}

if (fs.existsSync(DATA_FILE)) {
  try {
    store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  } catch (e) {
    store = {}
  }
}

// wait 500ms before writing so rapid requests don't spam the disk
let pendingWrite = null
function bufferedSave() {
  if (pendingWrite) clearTimeout(pendingWrite)
  pendingWrite = setTimeout(() => {
    fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), err => {
      if (err) console.error('save error:', err)
    })
  }, 500)
}

function makeCode() {
  return Math.random().toString(36).slice(2, 8)
}

// blacklisted keywords
const banned = ['virus', 'malware', 'scam']

// A7 — recycle links not clicked in 72 hours
function recycleOldLinks() {
  const now = Date.now()
  const seventyTwoHours = 72 * 60 * 60 * 1000
  let anyDeleted = false

  for (const code in store) {
    const link = store[code]
    const lastActivity = link.lastClickedAt || link.createdAt
    if (now - new Date(lastActivity).getTime() > seventyTwoHours) {
      delete store[code]
      anyDeleted = true
    }
  }

  if (anyDeleted) bufferedSave()
}

setInterval(recycleOldLinks, 60 * 60 * 1000)

app.get('/', (_, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>URL Shortener</title>
      <style>
        body { font-family: monospace; background: #0f0f0f; color: #ccc; display: flex; justify-content: center; padding-top: 100px; margin: 0; }
        .box { width: 100%; max-width: 480px; }
        h2 { color: #fff; margin-bottom: 24px; }
        input { width: 100%; padding: 10px; background: #1a1a1a; border: 1px solid #333; color: #fff; font-family: monospace; font-size: 14px; box-sizing: border-box; }
        button { margin-top: 10px; padding: 10px 24px; background: #ffad32; border: none; color: #000; font-family: monospace; font-size: 14px; cursor: pointer; }
        button:hover { background: #ec9228; }
        #result { margin-top: 20px; font-size: 14px; }
        #result a { color: #ffad32; }
        #result .err { color: #e05555; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2>URL Shortener</h2>
        <input id="url" type="text" placeholder="https://example.com" />
        <br />
        <button onclick="shorten()">Shorten</button>
        <div id="result"></div>
      </div>
      <script>
        async function shorten() {
          const url = document.getElementById('url').value.trim()
          const out = document.getElementById('result')
          if (!url) return

          const res = await fetch('/shorten', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
          })
          const data = await res.json()

          if (res.ok) {
            out.innerHTML = 'Short link: <a href="' + data.short_url + '" target="_blank">' + data.short_url + '</a>'
          } else {
            out.innerHTML = '<span class="err">' + data.error + '</span>'
          }
        }
      </script>
    </body>
    </html>
  `)
})

app.post('/shorten', (req, res) => {
  const { url } = req.body

  if (!url) {
    return res.status(400).json({ error: 'url is required' })
  }

  // basic url check
  try {
    new URL(url)
  } catch {
    return res.status(400).json({ error: 'invalid url' })
  }

  //  reject blacklisted keywords
  const lower = url.toLowerCase()
  if (banned.some(word => lower.includes(word))) {
    return res.status(400).json({ error: 'url contains prohibited content' })
  }

  const code = makeCode()
  store[code] = {
    url,
    createdAt: new Date().toISOString(),
    lastClickedAt: null,
    clicks: 0
  }

  bufferedSave()

  res.status(201).json({
    short_url: `${req.protocol}://${req.get('host')}/${code}`,
    code,
    original_url: url
  })
})

app.get('/:code', (req, res) => {
  const code = req.params.code
  const link = store[code]

  if (!link) {
    // redirect to 404 page, stole a 404 page from github, lol 
    return res.status(404).sendFile(path.join(__dirname, '404.html'))
  }

  link.clicks++
  link.lastClickedAt = new Date().toISOString()
  bufferedSave()

  res.redirect(302, link.url)
})

app.use((_, res) => {
  res.status(404).sendFile(path.join(__dirname, '404.html'))
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`)
})
