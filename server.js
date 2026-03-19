import express from 'express'
import fs from 'fs'
import path from 'path'
import { app } from './src/App.js'

const server = express()
const PORT = 3000
const OUTPUT_DIR = 'output'

server.use(express.json())
server.use(express.static('public'))

// Step 1: Run the downloader, return the filename
server.post('/download', async (req, res) => {
    const { url } = req.body
    if (!url) {
        return res.status(400).json({ error: 'URL is required' })
    }

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true })
    }

    // Snapshot modification times before download
    const snapshotMtimes = {}
    for (const f of fs.readdirSync(OUTPUT_DIR)) {
        snapshotMtimes[f] = fs.statSync(path.join(OUTPUT_DIR, f)).mtimeMs
    }
    const startTime = Date.now()

    try {
        await app.execute(url)

        // Find the file that is new or was modified after the snapshot
        const newFile = fs.readdirSync(OUTPUT_DIR).find(f => {
            const mtime = fs.statSync(path.join(OUTPUT_DIR, f)).mtimeMs
            return !(f in snapshotMtimes) || mtime > startTime
        })

        if (!newFile) {
            return res.status(500).json({ error: 'Download completed but no output file was found.' })
        }

        res.json({ filename: newFile })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Step 2: Serve the file, then delete it
server.get('/file/:filename', (req, res) => {
    const filename = path.basename(req.params.filename) // prevent path traversal
    const filePath = path.resolve(OUTPUT_DIR, filename)

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' })
    }

    res.download(filePath, filename, (err) => {
        if (!err) fs.unlinkSync(filePath)
    })
})

server.listen(PORT, () => {
    console.log(`Scribd Downloader running at http://localhost:${PORT}`)
})
