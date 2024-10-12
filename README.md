# jstgbot

## Message format
```
// 1. URL message (single or multiple URLs)
{
  "messageType": "url",
  "urls": [
    "https://example.com/page?param1=value1",
    "https://another-example.com/article"
  ]
}

// 2. Document message
{
  "messageType": "file",
  "fileType": "application/pdf",
  "fileUrl": "https://api.telegram.org/file/bot123e4567-e89b-12d3-a456-426614174000/documents/report.pdf",
  "fileName": "quarterly_report.pdf"
}

// 3. Image message
{
  "messageType": "file",
  "fileType": "image/jpeg",
  "fileUrl": "https://api.telegram.org/file/bot123e4567-e89b-12d3-a456-426614174000/photos/picture.jpg",
  "fileName": "image.jpg"
}

// 4. Video message
{
  "messageType": "file",
  "fileType": "video/mp4",
  "fileUrl": "https://api.telegram.org/file/bot123e4567-e89b-12d3-a456-426614174000/videos/clip.mp4",
  "fileName": "vacation_video.mp4"
}

// 5. Other file types (e.g., audio)
{
  "messageType": "file",
  "fileType": "audio/mpeg",
  "fileUrl": "https://api.telegram.org/file/bot123e4567-e89b-12d3-a456-426614174000/audio/song.mp3",
  "fileName": "favorite_song.mp3"
}
```