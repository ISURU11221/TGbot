const TelegramBot = require('node-telegram-bot-api');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');

// Replace with your Telegram Bot token
const token = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

// Create a new bot instance
const bot = new TelegramBot(token, { polling: true });

// Event listener for '/start' command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome to the YouTube Video Downloader bot! Please send me the YouTube video link.');
});

// Event listener for receiving messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  if (msg.text && ytdl.validateURL(msg.text)) {
    try {
      const videoInfo = await ytdl.getInfo(msg.text);
      const videoTitle = videoInfo.videoDetails.title;
      const videoFormats = videoInfo.formats;

      // Filter for video formats with audio and video
      const filteredFormats = videoFormats.filter((format) => format.hasAudio && format.hasVideo);

      // Sort formats by resolution (highest to lowest)
      const sortedFormats = filteredFormats.sort((a, b) => b.width - a.width);

      // Get the highest resolution format
      const highestResolutionFormat = sortedFormats[0];

      // Download the video using the highest resolution format
      const videoStream = ytdl.downloadFromInfo(videoInfo, {
        format: highestResolutionFormat,
      });

      // Generate a unique filename for the downloaded video
      const fileName = `${Date.now()}-${videoTitle.replace(/\W+/g, '-')}.mp4`;

      // Create a write stream to save the video file
      const filePath = path.join(__dirname, fileName);
      const fileStream = fs.createWriteStream(filePath);

      // Variables for tracking download progress
      let totalBytes = 0;
      let receivedBytes = 0;
      let progress = 0;

      // Get total file size from the content length header
      const contentLength = parseInt(highestResolutionFormat.contentLength, 10);
      if (contentLength) {
        totalBytes = contentLength;
      }

      // Pipe the video stream to the file stream and track progress
      videoStream.pipe(fileStream);

      // Event listener for data chunks received
      videoStream.on('data', (chunk) => {
        receivedBytes += chunk.length;

        // Calculate progress percentage
        progress = Math.round((receivedBytes / totalBytes) * 100);
      });

      // Event listener for when the video is fully downloaded
      videoStream.on('end', () => {
        bot.sendMessage(chatId, `Download complete: 100%`);

        const videoFile = fs.readFileSync(filePath);
        byte = Math.round(receivedBytes / (1024*1024));

        // Send the video as a document with the progress percentage
        bot.sendDocument(chatId, filePath, { caption: videoTitle + ': Size:-' + byte +'MB'
        }).then(() => {
          // Delete the downloaded file after uploading
          fs.unlinkSync(filePath);
        }).catch((error) => {
          console.error('Error uploading video:', error);
          bot.sendMessage(chatId, 'An error occurred while uploading the video.');
        });
      });

      // Event listener for any errors during download
      videoStream.on('error', (error) => {
        console.error('Error downloading video:', error);
        bot.sendMessage(chatId, 'An error occurred while downloading the video.');
      });

      // Interval for updating the progress message
      const progressInterval = setInterval(() => {
        bot.editMessageText(`Downloading: ${progress}%`, {
          chat_id: chatId,
          message_id: msg.message_id,
        });
      }, 1000);

      // Cleanup the progress interval on download completion
      videoStream.on('end', () => {
        clearInterval(progressInterval);
      });
    } catch (error) {
      console.error('Error retrieving video info:', error);
      bot.sendMessage(chatId, 'An error occurred while retrieving video information.');
    }
  } else {
    bot.sendMessage(chatId, 'Invalid YouTube video link. Please try again.');
  }
});
