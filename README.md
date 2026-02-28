# URL Shortener — a7b2c4

A simple URL shortener built with Node.js and Express.

## My Combination

**A7 — The Heavy-Lifter**
Links that haven't been clicked in 72 hours are automatically removed. A cleanup function runs every hour, checks the `lastClickedAt` timestamp (falls back to `createdAt` if the link was never clicked), and deletes anything stale.

**B2 — The Malware Filter**
Any URL containing the words `virus`, `malware`, or `scam` is rejected at creation time with a `400` error. The check is case-insensitive.

**C4 — The Custom Ghost**
Instead of a plain error, expired or missing links get a custom dark-themed HTML 404 page.

---

## Setup

```bash
npm install
node index.js
```

Server starts on port `3000` by default (or `PORT` env variable for deployment).

---

## API

### Create a short link
```
POST /shorten
Content-Type: application/json

{ "url": "https://example.com" }
```
Returns `201`:
```json
{
  "short_url": "http://localhost:3000/a1b2c3",
  "code": "a1b2c3",
  "original_url": "https://example.com"
}
```

### Use a short link
```
GET /:code
```
Redirects (`302`) to the original URL, or shows the custom 404 page.

---

## Technical Notes

- All timestamps stored in ISO/UTC format
- In-memory `store` object backed by `data.json` for persistence
- Writes are buffered (500ms delay) to prevent disk-lock under high load
- Status codes: `201` for creation, `302` for redirects, `400` for bad input, `404` for missing links
