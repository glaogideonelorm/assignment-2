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
    <html>
      <body style="font-family:monospace;padding:40px;background:#0f0f0f;color:#ccc">
        <h2>URL Shortener</h2>
        <p>POST /shorten with <code>{ "url": "..." }</code></p>
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
